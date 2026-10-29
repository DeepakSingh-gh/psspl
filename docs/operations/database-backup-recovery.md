# SQLite backup and recovery

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

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


## Email queue and credential-message recovery

Preserve `CRM_EMAIL_QUEUE_KEY` separately from encrypted database backups as well as preserving the backup encryption key. Pending account emails can contain an admin-authorized initial password inside AES-256-GCM queue payloads; do not export/decrypt these into logs or recovery reports. Restoring a database does not authorize resubmission of its pending emails.

Before starting a restored worker, review queued providers, account status, token expiry, credential-version checks and ambiguous prior outcomes. SMTP jobs with expired processing leases are not blindly replayed; provider acceptance does not confirm inbox delivery. Migration 013 pins the provider, and migration 014 rebuilds queue/delivery constraints while preserving rows and indexes. Back up and review those migrations before applying them to a production target. See the [email operations guide](gmail-smtp-authentication.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
