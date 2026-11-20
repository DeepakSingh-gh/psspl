# RM check-in location operations

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](2026-11-20-current-state.md); [automatic pipeline synchronization](../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Local implementation updated on 20 November 2026. The check-in button requests one fresh high-accuracy browser fix (15-second timeout, no cached position). It stores original latitude/longitude, reported accuracy, browser capture timestamp and server check-in timestamp. It starts no automatic position watch.

Permission denial, unavailable GPS and timeout leave attendance unsaved until the user retries or explicitly chooses **Check in without GPS**. Existing no-GPS attendance policy is preserved. A reported accuracy over 100 meters requires explicit acceptance or retry; this is a warning threshold, not proof of real-world positioning quality. Duplicate/retried check-ins cannot replace the day's original record. Only the authenticated RM/salesperson identity is used; client IDs are ignored.

## Self-hosted reverse geocoding

The user selected self-hosted Nominatim support and deferred endpoint configuration. Set these **server-side** settings when that service is ready:

```dotenv
# Replace with your actual approved self-hosted reverse endpoint.
CRM_REVERSE_GEOCODE_URL=http://nominatim.internal:8080/reverse
CRM_GEOCODE_INTERVAL_MS=1000
CRM_GEOCODE_USER_AGENT=PSSPL-CRM/0.2 (your operations contact)
```

Restart the API after configuring the endpoint. No endpoint was configured by this implementation. Until configured, GPS/map functionality works and addresses display **Address unavailable**. Do not put these settings in browser/public environment variables. No API key or paid dependency was introduced. The endpoint must speak the Nominatim `jsonv2` reverse API; providers with different formats require their own adapter.

The public `nominatim.openstreetmap.org` endpoint is deliberately excluded, including its trailing-dot spelling. Its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) restricts traffic and forbids personal/confidential submissions. Employee check-in GPS is handled as private CRM evidence. Self-hosted services have their own capacity/privacy policies; set a suitable application-wide rate and retain access controls. Do not use a public alias/proxy to bypass this restriction.

Lookups run after the check-in commit, one at a time per API process, at least one second apart, with an eight-second request timeout. Provider `429` responses respect Retry-After with a minimum one-minute cooldown. Durable provider slots coordinate normal scheduling through SQLite. Exact-coordinate cached formatted addresses last 30 days; failed results cache for ten minutes. Precise and coarse/unknown GPS use separate cache entries. Multi-process/high-volume installations should enforce provider-wide limits at the self-hosted gateway as well; no distributed queue infrastructure was added.

Only the original attendance ID and coordinates can receive the result. A provider error cannot delete GPS, overwrite another day's location or create guessed address fields. Missing/invalid/distant provider feature coordinates are rejected. Road details require sufficiently precise GPS and a nearby returned feature; coarse/unknown GPS yields only reported city/state. Missing fields remain omitted. Nominatim returns a nearest suitable mapped feature, so even a resolved address is approximate: see [official reverse-geocoding behavior](https://nominatim.org/release-docs/latest/api/Reverse/#how-it-works). Map links always use the captured coordinates.

Pending jobs recorded by an actual check-in recover on API restart. Legacy rows whose metadata is null are not automatically backfilled. An unavailable result is retained truthfully; configuring a provider later does not silently bulk-geocode historical employees. Any historical reprocessing needs a separate explicit operation.

## Admin display and history

Admin Overview's check-in map/roster show the saved attendance point, readable address or lookup status, reported accuracy, original check-in time and GPS capture time (when available), plus **View Map**. View Map opens exact lat/lon rather than searching an address. Current coordinates are never replaced with the most recent movement ping.

Field Activity has a **Check-in location history** disclosure showing the latest 60 saved records with the same details. Existing attendance revision monitoring refreshes active Admin views automatically (normally within its two-second visible-tab interval). The fingerprint now includes GPS/address metadata, so delayed address resolution also updates without manual refresh. Focus/network recovery behavior is retained. This reuses the existing attendance monitor; lead SSE and Tally sync remain separate.

Movement history uses India business-day boundaries. Old attendance accuracy remains unavailable when it was never stored; the application no longer borrows it from the first movement ping. Check-in and capture times are stored as UTC ISO timestamps and displayed in Asia/Kolkata, including day rollover. Existing explicitly triggered visit/check-out GPS actions remain; no continuous tracking was introduced.

See the [audit, changes and test evidence](../uat/check-in-location-2026-11-20/report.md). Real-device mobile GPS, permission prompts, HTTPS deployment, actual self-hosted geocoder responses and address correctness still need field verification after endpoint configuration.

## Phone screenshot follow-up: HTTP LAN access and checkout state

A phone opening `http://192.168.1.18:3000/sales/my-day` is using an insecure LAN origin. Browser geolocation requires a secure context; the localhost exception on the development computer does not make its LAN IP secure on another device. See [MDN geolocation requirements](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).

The app now reports the HTTPS prerequisite before attempting an insecure location request. Use a trusted HTTPS endpoint for this same local CRM/backend, with a certificate valid for its hostname/IP and trusted by the phone. An untrusted certificate warning or simply permitting location does not establish that setup. No HTTPS certificate, phone trust configuration or public tunnel was installed by this follow-up. Self-hosted reverse geocoding remains a separate, deferred configuration step.

The completed-day control now reads Checked Out. Successful check-in/checkout messages use an informational status message, leaving the error banner for actual failures. Checkout requests are guarded against duplicate clicks. When no GPS check-in was recorded, the card states that explicitly rather than claiming a saved location. Existing attendance records and daily uniqueness rules are unchanged.
