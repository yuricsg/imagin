import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export type DashboardUser = {
  id: string;
  email: string;
  name: string | null;
};

/** Normalizes emails so lookups are case/whitespace-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Returns the user when the password matches, or null otherwise. */
  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<DashboardUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
    if (!row) return null;
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) return null;
    return { id: row.id, email: row.email, name: row.name };
  }

  /** Command-palette pins for a user, in pin order. Empty when unknown. */
  async getPinnedCommands(email: string): Promise<string[]> {
    const row = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { pinnedCommands: true },
    });
    return row?.pinnedCommands ?? [];
  }

  /**
   * Replaces a user's pins. Returns the saved list, or null when the email is
   * not a provisioned user (nothing is created here).
   */
  async setPinnedCommands(
    email: string,
    commandIds: string[],
  ): Promise<string[] | null> {
    // Dedupe while preserving order; drop empties.
    const seen = new Set<string>();
    const clean = commandIds.filter((id) => {
      const trimmed = typeof id === "string" ? id.trim() : "";
      if (!trimmed || seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
    try {
      const row = await this.prisma.user.update({
        where: { email: normalizeEmail(email) },
        data: { pinnedCommands: clean },
        select: { pinnedCommands: true },
      });
      return row.pinnedCommands;
    } catch {
      // No such user (P2025) — pins belong to provisioned accounts only.
      return null;
    }
  }

  /** Creates or updates a user with a freshly hashed password. */
  async upsert(
    email: string,
    password: string,
    name?: string,
  ): Promise<DashboardUser> {
    const normalized = normalizeEmail(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const row = await this.prisma.user.upsert({
      where: { email: normalized },
      update: { passwordHash, ...(name !== undefined ? { name } : {}) },
      create: { email: normalized, passwordHash, name: name ?? null },
    });
    return { id: row.id, email: row.email, name: row.name };
  }
}
