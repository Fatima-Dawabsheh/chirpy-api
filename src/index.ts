import express from "express";
import config from "./config.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  createChirp,
  getChirps,
  getChirp,
  deleteChirp,
} from "./db/queries/chirps.js";
import {
  createUser,
  deleteAllUsers,
  getUserByEmail,
  updateUser,
} from "./db/queries/users.js";
import {
  hashPassword,
  checkPasswordHash,
  makeJWT,
  getAPIKey,
  getBearerToken,
  validateJWT,
} from "./auth.js";

import {
  createRefreshToken,
  getUserFromRefreshToken,
  revokeRefreshToken,
} from "./db/queries/refreshTokens.js";
import { upgradeUserToChirpyRed } from "./db/queries/users.js";
import { makeRefreshToken } from "./auth.js";
const app = express();

const migrationClient = postgres(config.db.url, { max: 1 });

await migrate(
  drizzle(migrationClient),
  config.db.migrationConfig,
);

app.use(express.json());

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// POST /api/chirps

const handlerCreateChirp = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  try {
    const { body } = req.body;
let userId: string;

try {
  const token = getBearerToken(req);
  userId = validateJWT(token, config.api.jwtSecret);
} catch {
  throw new UnauthorizedError("Unauthorized");
}	    


    if (typeof body !== "string") {
      throw new BadRequestError("Invalid request body");
    }

    if (body.length > 140) {
      throw new BadRequestError(
        "Chirp is too long. Max length is 140",
      );
    }

    const profaneWords = ["kerfuffle", "sharbert", "fornax"];

    let cleanedBody = body;

    for (const word of profaneWords) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleanedBody = cleanedBody.replace(regex, "****");
    }

    const chirp = await createChirp({
      body: cleanedBody,
      userId,
    });

    res.status(201).json(chirp);
  } catch (err) {
    next(err);
  }
};




// POST /api/users
const handlerCreateUser = async (
  req: express.Request,
  res: express.Response,
) => {
  const { email, password } = req.body;

  const hashedPassword = await hashPassword(password);

  const user = await createUser({
    email,
    hashedPassword,
  });

  const { hashedPassword: _, ...userResponse } = user;

  res.status(201).json(userResponse);
};
// GET /api/healthz
const handlerReadiness = (
  req: express.Request,
  res: express.Response,
) => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send("OK");
};

// GET /admin/metrics
const handlerMetrics = (
  req: express.Request,
  res: express.Response,
) => {
  res.set("Content-Type", "text/html; charset=utf-8");

  res.status(200).send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
      </body>
    </html>
  `);
};

// POST /admin/reset
const handlerReset = async (
  req: express.Request,
  res: express.Response,
) => {
  config.api.fileserverHits = 0;

  await deleteAllUsers();

  res.status(200).send("Reset successful");
};

// Middleware to count app hits
const middlewareMetricsInc = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  config.api.fileserverHits++;
  next();
};


const handlerGetChirps = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  let authorId = "";
  const authorIdQuery = req.query.authorId;

  if (typeof authorIdQuery === "string") {
    authorId = authorIdQuery;
  }

  let sort = "asc";
  const sortQuery = req.query.sort;

  if (typeof sortQuery === "string" && sortQuery === "desc") {
    sort = "desc";
  }

  const allChirps = authorId
    ? await getChirps(authorId)
    : await getChirps();

  allChirps.sort((a, b) => {
    const difference =
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime();

    return sort === "desc" ? -difference : difference;
  });

  res.status(200).json(allChirps);
};

const handlerGetChirp = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  const chirpId = req.params.chirpId as string;
  const chirp = await getChirp(chirpId);

  if (!chirp) {
    res.status(404).json({
      error: "Chirp not found",
    });
    return;
  }

  res.status(200).json(chirp);
};


const handlerLogin = async (
  req: express.Request,
  res: express.Response,
) => {
  const { email, password, expiresInSeconds } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    res.status(401).json({
      error: "incorrect email or password",
    });
    return;
  }

  const passwordMatches = await checkPasswordHash(
    password,
    user.hashedPassword,
  );

  if (!passwordMatches) {
    res.status(401).json({
      error: "incorrect email or password",
    });
    return;
  }

  const expiresIn =
    typeof expiresInSeconds === "number"
      ? Math.min(expiresInSeconds, 60 * 60)
      : 60 * 60;

 const token = makeJWT(
  user.id,
  60 * 60,
  config.api.jwtSecret,
);

const refreshToken = makeRefreshToken();

await createRefreshToken({
  token: refreshToken,
  userId: user.id,
  expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
});

  const { hashedPassword: _, ...userResponse } = user;

  res.status(200).json({
    ...userResponse,
    token,
    refreshToken, 
 });
};


const handlerRefresh = async (
  req: express.Request,
  res: express.Response,
) => {
  let refreshToken: string;

  try {
    refreshToken = getBearerToken(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = await getUserFromRefreshToken(refreshToken);

  if (!result) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = makeJWT(
    result.userId,
    60 * 60,
    config.api.jwtSecret,
  );

  res.status(200).json({ token });
};



const handlerRevoke = async (
  req: express.Request,
  res: express.Response,
) => {
  let refreshToken: string;

  try {
    refreshToken = getBearerToken(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await revokeRefreshToken(refreshToken);

  res.status(204).send();
};

const handlerDeleteChirp = async (
  req: express.Request,
  res: express.Response,
) => {
  let userId: string;

  try {
    const token = getBearerToken(req);
    userId = validateJWT(token, config.api.jwtSecret);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const chirpId = req.params.chirpId as string;
  const chirp = await getChirp(chirpId);

  if (!chirp) {
    res.status(404).json({ error: "Chirp not found" });
    return;
  }

  if (chirp.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await deleteChirp(chirpId);
  res.status(204).send();
};


// Routes

app.post("/api/users", handlerCreateUser);

app.get("/api/healthz", handlerReadiness);

app.get("/admin/metrics", handlerMetrics);

app.post("/admin/reset", handlerReset);

app.post("/api/chirps", handlerCreateChirp);

app.post("/api/login", handlerLogin);
app.post("/api/refresh", handlerRefresh);
app.post("/api/revoke", handlerRevoke);

app.post("/api/polka/webhooks", async (req, res) => {
  let apiKey: string;

  try {
    apiKey = getAPIKey(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (apiKey !== config.api.polkaKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { event, data } = req.body;

  if (event !== "user.upgraded") {
    res.status(204).send();
    return;
  }

  const userId = data?.userId;

  if (typeof userId !== "string") {
    res.status(404).send();
    return;
  }

  const user = await upgradeUserToChirpyRed(userId);

  if (!user) {
    res.status(404).send();
    return;
  }

  res.status(204).send();
});


app.get("/api/chirps", handlerGetChirps);
app.get("/api/chirps/:chirpId", handlerGetChirp);
app.delete("/api/chirps/:chirpId", handlerDeleteChirp);
app.use(
  "/app",
  middlewareMetricsInc,
  express.static("./src/app"),
);

app.put("/api/users", async (req, res) => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.api.jwtSecret);

    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password
    ) {
      res.status(400).send("Email and password are required");
      return;
    }

    const hashedPassword = await hashPassword(password);
    const updatedUser = await updateUser(
      userId,
      email,
      hashedPassword,
    );

    if (!updatedUser) {
      res.status(404).send("User not found");
      return;
    }

    const { hashedPassword: _, ...userResponse } = updatedUser;
    res.status(200).json(userResponse);
  } catch {
    res.status(401).send("Unauthorized");
  }
});

// Error handler MUST be after all routes
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err instanceof BadRequestError) {
      res.status(400).json({
        error: err.message,
      });
      return;
    }

    if (err instanceof NotFoundError) {
      res.status(404).json({
        error: err.message,
      });
      return;
    }

    if (err instanceof UnauthorizedError) {
      res.status(401).json({
        error: err.message,
      });
      return;
    }

    if (err instanceof ForbiddenError) {
      res.status(403).json({
        error: err.message,
      });
      return;
    }

    console.error(err);

    res.status(500).json({
      error: "Something went wrong on our end",
    });
  },
);

app.listen(config.api.port, () => {
  console.log(`Server is running at http://localhost:${config.api.port}`);
});


