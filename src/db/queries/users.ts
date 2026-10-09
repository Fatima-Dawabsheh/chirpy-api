
import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users, NewUser } from "../schema.js";
export async function upgradeUserToChirpyRed(userId: string) {
  const [user] = await db
    .update(users)
    .set({
      isChirpyRed: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return user;
}
export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .returning();

  return result;
}

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  return user;
}

export async function deleteAllUsers() {
  await db.delete(users);
}
export async function updateUser(
  id: string,
  email: string,
  hashedPassword: string,
) {
  const [user] = await db
    .update(users)
    .set({ email, hashedPassword })
    .where(eq(users.id, id))
    .returning();

  return user;
}
