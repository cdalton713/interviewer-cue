import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  decryptGranolaPayload,
  decryptMacSafeStoragePayload,
} from "./cache-crypto.js";
import type { DecryptArgs, GranolaCacheFile } from "./types.js";

export function getKeychainPassphrase(service: string, account: string): string {
  return childProcess
    .execFileSync(
      "security",
      ["find-generic-password", "-s", service, "-a", account, "-w"],
      { encoding: "utf8" },
    )
    .trimEnd();
}

export function readDecryptedCacheWithDek(
  granolaDir: string,
  dek: Buffer,
): GranolaCacheFile {
  const encryptedCache = fs.readFileSync(
    path.join(granolaDir, "cache-v6.json.enc"),
  );

  return JSON.parse(decryptGranolaPayload(encryptedCache, dek)) as GranolaCacheFile;
}

export function readDek(args: Pick<DecryptArgs, "granolaDir" | "keychainService" | "keychainAccount">): Buffer {
  const encryptedDek = fs.readFileSync(path.join(args.granolaDir, "storage.dek"));
  const passphrase = getKeychainPassphrase(
    args.keychainService,
    args.keychainAccount,
  );
  const dekBase64 = decryptMacSafeStoragePayload(encryptedDek, passphrase);
  return Buffer.from(dekBase64, "base64");
}

export function readDecryptedCache(args: DecryptArgs): GranolaCacheFile {
  return readDecryptedCacheWithDek(args.granolaDir, readDek(args));
}
