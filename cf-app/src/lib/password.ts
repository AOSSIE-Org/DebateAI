import bcrypt from "bcryptjs";

/**
 * Password hashing — kept on bcrypt so every hash exported from the Mongo
 * `users.password` field verifies unchanged. bcryptjs is pure-JS and runs on
 * Workers; cost 10 (bcrypt.DefaultCost, matching golang.org/x/crypto/bcrypt).
 *
 * Note: hashing ~cost 10 is a few hundred ms of CPU on the isolate. That's fine
 * for signup/login volume. If it ever matters, migrate opportunistically to
 * WebCrypto PBKDF2/scrypt on next successful login.
 */
const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
