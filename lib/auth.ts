import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query, uuid } from "./db";
import { appOrigin } from "./environment";
import type { User, Role } from "@/types/domain";
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get("nehir_session")?.value;
  if (!token) return null;
  const rows = await query(
    `SELECT u.id,u.name,u.email,u.role,u.grade,u.daily_minutes FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hashToken(token)],
  );
  return (rows[0] as User | undefined) ?? null;
}
export async function requireUser(roles?: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Lütfen giriş yap.");
  if (roles && !roles.includes(user.role))
    throw new HttpError(403, "Bu işlem için yetkin yok.");
  return user;
}
export async function createSession(id: string) {
  const token = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '7 days')`,
    [uuid(), id, hashToken(token)],
  );
  (await cookies()).set("nehir_session", token, {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL) || appOrigin().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}
export async function studentScope(
  user: User,
  requested?: string,
): Promise<string> {
  if (user.role === "STUDENT") {
    if (requested && requested !== user.id)
      throw new HttpError(403, "Bu öğrenciye erişimin yok.");
    return user.id;
  }
  if (!requested) throw new HttpError(400, "Öğrenci seçilmeli.");
  if (user.role === "PARENT") {
    const links = await query(
      `SELECT student_id FROM parent_student_links WHERE parent_id=$1 AND student_id=$2`,
      [user.id, requested],
    );
    if (!links.length) throw new HttpError(403, "Bu öğrenciye erişimin yok.");
  }
  const target = await query(`SELECT id FROM users WHERE id=$1 AND role=$2`, [
    requested,
    "STUDENT",
  ]);
  if (!target.length) throw new HttpError(404, "Öğrenci bulunamadı.");
  return requested;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(req.url).origin;
  const app = appOrigin(req.url);
  let sameHost = false;
  try {
    sameHost = Boolean(
      origin &&
      ["http:", "https:"].includes(new URL(origin).protocol) &&
      new URL(origin).host === req.headers.get("host"),
    );
  } catch {
    throw new HttpError(403, "İstek kaynağı doğrulanamadı.");
  }
  if (!origin || (origin !== expected && origin !== app && !sameHost))
    throw new HttpError(403, "İstek kaynağı doğrulanamadı.");
}
