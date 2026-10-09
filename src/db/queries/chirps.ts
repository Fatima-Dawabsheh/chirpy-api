import { eq, asc } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";

export async function createChirp(chirp: {
  body: string;
  userId: string;
}) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();

  return result;
}

export async function getChirps(authorId?: string) {
  if (authorId) {
    return await db
      .select()
      .from(chirps)
      .where(eq(chirps.userId, authorId));
  }

  return await db.select().from(chirps);
}

export async function getChirp(chirpId: string) {
  const [result] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, chirpId));

  return result;
}
export async function deleteChirp(chirpId: string) {
  const [chirp] = await db
    .delete(chirps)
    .where(eq(chirps.id, chirpId))
    .returning();

  return chirp;
}
