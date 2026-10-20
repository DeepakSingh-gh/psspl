import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MAGIC = Buffer.from("PSSPLBK1");
const RETENTION_COUNT = 30;
const FINAL_BACKUP_RE = /^psspl-\d{4}-\d{2}-\d{2}T.*-[0-9a-f]{16}\.sqlite\.enc$/;
const TEMP_BACKUP_RE = /^\.psspl-backup-[0-9a-f]{32}\.tmp$/;
const STALE_TEMP_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function encryptionKey() {
  const value = process.env.CRM_BACKUP_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("CRM_BACKUP_ENCRYPTION_KEY must be a dedicated 64-character hex key (32 bytes).");
  }
  return Buffer.from(value, "hex");
}

function encrypt(plain, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(payload, key) {
  if (payload.length < MAGIC.length + 12 + 16 || !payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Backup format is invalid or unsupported.");
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + 12;
  const cipherStart = tagStart + 16;
  const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(ivStart, tagStart));
  decipher.setAuthTag(payload.subarray(tagStart, cipherStart));
  return Buffer.concat([decipher.update(payload.subarray(cipherStart)), decipher.final()]);
}

function validateSqlite(filePath) {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = database.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrity !== "ok") throw new Error(`SQLite integrity check failed: ${integrity ?? "no result"}`);
  } finally {
    database.close();
  }
}

function cleanupStaleBackupTemps(destination) {
  const cutoff = Date.now() - STALE_TEMP_AGE_MS;
  for (const name of readdirSync(destination)) {
    if (!TEMP_BACKUP_RE.test(name)) continue;
    const tempPath = join(destination, name);
    try {
      const metadata = lstatSync(tempPath);
      if (metadata.isFile() && metadata.mtimeMs < cutoff) rmSync(tempPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

function backup() {
  const source = resolve(process.env.CRM_DATABASE_PATH || "data/crm.sqlite");
  const destination = process.env.CRM_BACKUP_DIR && resolve(process.env.CRM_BACKUP_DIR);
  if (!destination) throw new Error("CRM_BACKUP_DIR must point to a dedicated persistent backup directory.");
  const key = encryptionKey();
  if (!existsSync(source) || !statSync(source).isFile()) throw new Error(`SQLite database does not exist: ${source}`);
  const sourceRelativeToBackupDir = relative(destination, source);
  if (!sourceRelativeToBackupDir || (!sourceRelativeToBackupDir.startsWith(`..${sep}`) && sourceRelativeToBackupDir !== ".." && !isAbsolute(sourceRelativeToBackupDir))) {
    throw new Error("Backup destination must be separate from and must not contain the source database.");
  }
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  cleanupStaleBackupTemps(destination);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshot = join(tmpdir(), `psspl-snapshot-${randomBytes(8).toString("hex")}.sqlite`);
  const nonce = randomBytes(8).toString("hex");
  const target = join(destination, `psspl-${stamp}-${nonce}.sqlite.enc`);
  const tempTarget = join(destination, `.psspl-backup-${randomBytes(16).toString("hex")}.tmp`);
  let database;
  let tempDescriptor;
  try {
    database = new DatabaseSync(source);
    const escaped = snapshot.replace(/'/g, "''");
    database.exec(`VACUUM INTO '${escaped}'`);
    try { chmodSync(snapshot, 0o600); } catch {}
    database.close();
    database = undefined;
    validateSqlite(snapshot);
    const snapshotBytes = readFileSync(snapshot);
    const encrypted = encrypt(snapshotBytes, key);
    tempDescriptor = openSync(tempTarget, "wx", 0o600);
    writeFileSync(tempDescriptor, encrypted);
    fsyncSync(tempDescriptor);
    closeSync(tempDescriptor);
    tempDescriptor = undefined;
    try { chmodSync(tempTarget, 0o600); } catch {}
    const completedBytes = readFileSync(tempTarget);
    if (!decrypt(completedBytes, key).equals(snapshotBytes)) throw new Error("Encrypted backup validation failed before publication.");
    renameSync(tempTarget, target);
    try {
      const directoryDescriptor = openSync(destination, "r");
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } catch {}
  } finally {
    if (tempDescriptor !== undefined) closeSync(tempDescriptor);
    database?.close();
    rmSync(snapshot, { force: true });
    rmSync(tempTarget, { force: true });
  }

  const backups = readdirSync(destination)
    .filter((name) => FINAL_BACKUP_RE.test(name))
    .sort((a, b) => b.localeCompare(a));
  for (const stale of backups.slice(RETENTION_COUNT)) rmSync(join(destination, stale), { force: true });
  console.log(`Encrypted SQLite backup created: ${basename(target)} (retaining ${RETENTION_COUNT} most recent backups).`);
}

function restore(backupPathArg, targetArg) {
  if (!backupPathArg || !targetArg) throw new Error("Usage: node scripts/backup-sqlite.mjs restore <encrypted-backup> <new-database-path>");
  const backupPath = resolve(backupPathArg);
  const target = resolve(targetArg);
  const key = encryptionKey();
  if (!FINAL_BACKUP_RE.test(basename(backupPath))) throw new Error("Restore requires a completed, published PSSPL backup file.");
  if (!existsSync(backupPath) || !statSync(backupPath).isFile()) throw new Error("Encrypted backup file was not found.");
  if (existsSync(target)) throw new Error("Restore target already exists; choose a new path so existing data cannot be overwritten.");
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temp = join(dirname(target), `.${basename(target)}.${randomBytes(8).toString("hex")}.restore-tmp`);
  try {
    writeFileSync(temp, decrypt(readFileSync(backupPath), key), { flag: "wx", mode: 0o600 });
    validateSqlite(temp);
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
  console.log(`Database restored and integrity-checked at new path: ${target}`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "backup") backup();
  else if (command === "restore") restore(args[0], args[1]);
  else throw new Error("Usage: node scripts/backup-sqlite.mjs backup | restore <encrypted-backup> <new-database-path>");
} catch (error) {
  console.error(`[db-backup] ${error.message}`);
  process.exitCode = 1;
}
