import "server-only";
import { dbAvailable, prisma } from "@/lib/server/db";
import { decrypt, encrypt, encryptionConfigured } from "@/lib/server/crypto";

export type DfsCredentials = { login: string; password: string; source: "env" | "database" };

/** Env credentials take precedence; otherwise use the encrypted DB row saved from Settings. */
export async function getCredentials(): Promise<DfsCredentials | null> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (login && password) return { login, password, source: "env" };
  if (!(await dbAvailable()) || !encryptionConfigured()) return null;
  const row = await prisma.providerCredential.findUnique({ where: { provider: "dataforseo" } });
  if (!row) return null;
  try {
    return { login: row.login, password: decrypt(row.passwordEncrypted), source: "database" };
  } catch {
    return null; // key rotated or corrupted
  }
}

export async function saveCredentials(login: string, password: string) {
  const passwordEncrypted = encrypt(password);
  await prisma.providerCredential.upsert({
    where: { provider: "dataforseo" },
    create: { provider: "dataforseo", login, passwordEncrypted },
    update: { login, passwordEncrypted, lastVerifiedAt: null },
  });
}

export async function deleteCredentials() {
  await prisma.providerCredential.deleteMany({ where: { provider: "dataforseo" } });
}

/** Safe-to-display status: never includes the password. */
export async function credentialStatus() {
  const envSet = Boolean(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
  const db = await dbAvailable();
  const row = db ? await prisma.providerCredential.findUnique({ where: { provider: "dataforseo" } }) : null;
  const login = envSet ? process.env.DATAFORSEO_LOGIN!.trim() : row?.login;
  return {
    configured: envSet || Boolean(row),
    source: envSet ? ("env" as const) : row ? ("database" as const) : null,
    loginMasked: login ? maskLogin(login) : null,
    lastVerifiedAt: row?.lastVerifiedAt?.toISOString() ?? null,
    lastBalanceUsd: row?.lastBalanceUsd != null ? Number(row.lastBalanceUsd) : null,
    databaseAvailable: db,
    encryptionConfigured: encryptionConfigured(),
  };
}

function maskLogin(login: string) {
  const [user, domain] = login.split("@");
  if (!domain) return login.slice(0, 2) + "•••";
  return `${user.slice(0, 2)}•••@${domain}`;
}
