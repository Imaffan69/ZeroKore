import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Secret encryption for project environment variables.
 *
 * AES-256-GCM with a server-only key. Values are encrypted before they reach
 * the database and are only ever decrypted inside a route handler — the browser
 * receives key names, never values.
 *
 * The key comes from ENCRYPTION_KEY (32 bytes, base64 or hex). If it is not
 * set we refuse to store secrets rather than writing them in plaintext: an
 * unconfigured feature must say so, never pretend.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not configured, so project secrets cannot be stored. Set a 32-byte base64 or hex key on the server."
    );
  }
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or 64-char hex)."
    );
  }
  return buf;
}

export function isEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt to `iv.tag.ciphertext`, all base64. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(".");
}

/** Decrypt a value produced by encryptSecret. Throws on tampering. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored secret is malformed.");
  }
  const decipher = createDecipheriv(
    ALGO,
    key(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
