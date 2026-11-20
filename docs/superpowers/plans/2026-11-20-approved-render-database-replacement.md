# Approved Render database replacement

User explicitly approved replacing the remote database with the cleaned local database and discarding live-only records on 20 November 2026. Do not ask again for that authorized replacement.

- [ ] Create an online local SQLite snapshot. Preserve business rows and passwords; strip login/setup sessions and cancel pending outbound account emails in the copy only. Verify integrity, foreign keys and absence of active known fixtures.
- [ ] Add a small tested build-time bootstrap utility: bounded HTTPS download of an AES-256-GCM-encrypted gzip snapshot; verify ciphertext and plaintext checksums plus SQLite integrity before atomic creation. Refuse to overwrite an existing database.
- [ ] Publish only the encrypted artifact through GitHub release assets. Keep the encryption key in Render environment configuration and ignored local handoff state; no plaintext database/keys in public source.
- [ ] Configure the existing Render build to prepare the approved snapshot, disable legacy/demo restore and leave automatic deployment held during rollout. Deploy a pinned tested source commit.
- [ ] Verify database counts, migrated schema, all four requested RM logins, authorized pipeline/check-in APIs and stream. Deploy Vercel production and verify production URL/commit.
- [ ] Record exact status and the Free-plan limitation: runtime filesystem remains ephemeral; this is an approved seed snapshot, not ongoing backup/persistence. Restore previous auto-deploy behavior only if safe and clearly documented.
