import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  decryptGranolaPayload,
  decryptMacSafeStoragePayload,
} from "../src/granola/cache-crypto.js";

function encryptLikeGranola(text: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  return Buffer.concat([
    iv,
    cipher.update(text, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}

describe("decryptGranolaPayload", () => {
  it("reads iv-prefixed aes-256-gcm payloads", () => {
    const key = crypto.randomBytes(32);
    const payload = encryptLikeGranola('{"cache":true}', key);

    expect(decryptGranolaPayload(payload, key)).toBe('{"cache":true}');
  });

  it("rejects malformed keys", () => {
    const payload = Buffer.alloc(28);

    expect(() => decryptGranolaPayload(payload, Buffer.alloc(31))).toThrow(
      /Expected a 32-byte DEK/,
    );
  });
});

describe("decryptMacSafeStoragePayload", () => {
  it("decrypts Chromium v10 macOS payloads", () => {
    const passphrase = "keychain-secret";
    const key = crypto.pbkdf2Sync(passphrase, "saltysalt", 1003, 16, "sha1");
    const iv = Buffer.alloc(16, " ");
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([
      Buffer.from("v10"),
      cipher.update("dek-base64"),
      cipher.final(),
    ]);

    expect(decryptMacSafeStoragePayload(encrypted, passphrase)).toBe("dek-base64");
  });
});
