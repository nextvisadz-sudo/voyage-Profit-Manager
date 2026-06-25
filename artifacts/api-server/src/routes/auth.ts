import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signJwt } from "../lib/auth-service";

const router = Router();

// In-memory mock users list (fallback)
export const mockUsers = [
  { id: 1, username: "admin", passwordHash: hashPassword("admin123"), role: "admin" },
  { id: 2, username: "agent", passwordHash: hashPassword("agent123"), role: "agent" }
];

// Seed DB function
async function seedUsersIfNeeded() {
  if (!db) return;
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length === 0) {
      console.log("Seeding default database users...");
      await db.insert(usersTable).values([
        { username: "admin", password: hashPassword("admin123"), role: "admin" },
        { username: "agent", password: hashPassword("agent123"), role: "agent" }
      ]);
    }
  } catch (err) {
    console.error("Failed to seed database users:", err);
  }
}

// Call seed at startup
seedUsersIfNeeded();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Missing fields", message: "Nom d'utilisateur et mot de passe requis." });
    return;
  }

  let user: any = null;

  if (db) {
    try {
      const results = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
      if (results.length > 0) {
        const dbUser = results[0];
        if (verifyPassword(password, dbUser.password)) {
          user = { id: dbUser.id, username: dbUser.username, role: dbUser.role };
        }
      }
    } catch (err) {
      console.error("Database query error:", err);
    }
  }

  // Fallback to in-memory mock users
  if (!user) {
    const found = mockUsers.find(u => u.username === username);
    if (found && verifyPassword(password, found.passwordHash)) {
      user = { id: found.id, username: found.username, role: found.role };
    }
  }

  if (!user) {
    res.status(401).json({ error: "Invalid credentials", message: "Identifiants incorrects." });
    return;
  }

  const token = signJwt(user);
  
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  res.json({ user });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true, message: "Déconnexion réussie." });
});

router.get("/auth/me", (req, res): void => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Non authentifié." });
    return;
  }
  res.json({ user });
});

export default router;
