import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { refreshTokens } from "../schema.js";

export async function createRefreshToken(data: {
  token: string;
  userId: string;
  expiresAt: Date;
}) {
  const [result] = await db
    .insert(refreshTokens)
    .values(data)
    .returning();

  return result;
}

export async function getUserFromRefreshToken(token: string) {
  const [result] = await db
    .select({
      userId: refreshTokens.userId,
    })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    );

  return result;
}

export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(refreshTokens.token, token));
}

