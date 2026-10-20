# SQLite backup and recovery

The CRM database contains customer, sales and employee information. Backups created by `scripts/backup-sqlite.mjs` use SQLite's online `VACUUM INTO` snapshot in the host's temporary directory, restrict its file permissions where supported, validate SQLite integrity, and encrypt each snapshot with AES-256-GCM. The encrypted bytes are written to a uniquely named temporary file inside the destination, flushed, decrypted and compared with the validated snapshot, then atomically renamed to the final `.sqlite.enc` name on the same filesystem. Only final-name files are eligible for retention or restore. Authentication tags detect corruption or tampering. The plaintext snapshot is removed after the run; ensure host temporary storage is access-restricted and has enough space. Temporary backup artifacts are cleaned on normal failure/exit; a later run removes only matching tool temp files older than seven days and preserves recent files. Only the 30 newest completed backups are retained.

## Required deployment configuration

- `CRM_DATABASE_PATH`: the active SQLite file path. If omitted, the script uses `data/crm.sqlite` relative to its working directory.
- `CRM_BACKUP_DIR`: a dedicated, persistent directory mounted separately from the application checkout and database. The script deliberately has no repository-local or ephemeral fallback.
- `CRM_BACKUP_ENCRYPTION_KEY`: a dedicated 32-byte key encoded as exactly 64 hexadecimal characters. Store it in the host's secret manager separately from the backup files. A lost key makes encrypted backups unrecoverable; restrict access and maintain a separately protected key escrow.

Generate a key with a trusted cryptographic tool, for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; save it directly into the deployment secret manager and key escrow. Do not commit it or put it in the application `.env` file.

Run `npm run db:backup` from a host scheduler once per day, and monitor the command's exit status and free space. Confirm the mounted destination survives application restarts and deployments before relying on it. The current Render Free filesystem is documented as ephemeral, so it cannot serve as `CRM_BACKUP_DIR`; provision durable storage or an approved external backup destination before enabling this procedure. Do not treat the app's Supabase data synchronization as a backup.

## Recovery

Restore to a new, empty path first. Supply the same encryption key through the secret manager, then run:

```text
npm run db:restore -- <encrypted-backup-path> <new-database-path>
```

The restore command refuses to overwrite an existing target, authenticates/decrypts the backup, and runs `PRAGMA integrity_check` before making the restored file visible at the target path. Review the recovered data and application compatibility before any separately approved cutover. The restore tool does not start the backend or run migrations.

## Operating checks

Schedule a daily backup using the hosting platform's durable scheduled-job facility or an equivalent host scheduler. Alert on missed jobs and failures, monitor storage capacity, and periodically run a restore drill into a disposable path. Keep the encryption key outside both the source repository and backup volume. Retention removes only files matching this tool's `psspl-*.sqlite.enc` naming convention after a new validated backup is written.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
