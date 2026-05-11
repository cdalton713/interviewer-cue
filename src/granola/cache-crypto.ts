import crypto from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEK_LENGTH = 32;
const MAC_SAFE_STORAGE_PREFIX = "v10";

export function decryptGranolaPayload(payload: Buffer, dek: Buffer): string {
  if (!Buffer.isBuffer(payload)) {
    throw new TypeError("Expected payload to be a Buffer");
  }
  if (!Buffer.isBuffer(dek) || dek.length !== DEK_LENGTH) {
    throw new Error("Expected a 32-byte DEK");
  }
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted payload is too short");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(payload.length - TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH, payload.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function decryptMacSafeStoragePayload(
  payload: Buffer,
  passphrase: string,
): string {
  if (!Buffer.isBuffer(payload)) {
    throw new TypeError("Expected payload to be a Buffer");
  }
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new Error("Expected a non-empty safeStorage passphrase");
  }

  const prefix = payload.subarray(0, 3).toString("utf8");
  if (prefix !== MAC_SAFE_STORAGE_PREFIX) {
    throw new Error(`Unsupported safeStorage payload prefix: ${prefix}`);
  }

  const key = crypto.pbkdf2Sync(passphrase, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, " ");
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);

  return Buffer.concat([
    decipher.update(payload.subarray(3)),
    decipher.final(),
  ]).toString("utf8");
}
