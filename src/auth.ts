import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { Request } from "express";
import { randomBytes } from "node:crypto";

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export function makeRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export async function checkPasswordHash(
  password: string,
  hash: string,
): Promise<boolean> {
  return await argon2.verify(hash, password);
}

type Payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(
  userID: string,
  expiresIn: number,
  secret: string,
): string {
  const iat = Math.floor(Date.now() / 1000);

  const payload: Payload = {
    iss: "chirpy",
    sub: userID,
    iat,
    exp: iat + expiresIn,
  };

  return jwt.sign(payload, secret);
}

export function validateJWT(
  tokenString: string,
  secret: string,
): string {
  const payload = jwt.verify(tokenString, secret) as Payload;

  if (!payload.sub) {
    throw new Error("JWT does not contain a subject");
  }

  return payload.sub;
}
export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new Error("Authorization header not found");
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid authorization header");
  }

  return parts[1];
}

export function getAPIKey(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new Error("Authorization header not found");
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "ApiKey") {
    throw new Error("Invalid authorization header");
  }

  return parts[1].trim();
}

