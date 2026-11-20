# RM check-in location audit and fixes - 20 November 2026

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Implemented locally using the existing attendance API, SQLite records, Admin map and automatic attendance refresh. No production deployment, commit or push was performed. The user selected **self-hosted Nominatim support, with endpoint configuration deferred**.

## Findings and root causes

| Problem | Root cause | Fix |
| --- | --- | --- |
| Poor/stale check-in fixes | Low-accuracy browser request, no explicit maximumAge, no saved browser timestamp | High accuracy, maximumAge zero, 15-second timeout, saved original accuracy and capture timestamp |
| Attendance silently saved after permission/GPS failure | Geolocation error callback called the no-GPS save directly | Actionable denied/unavailable/timeout messages; retry or an explicit no-GPS choice |
| Background tracking and redundant points | Check-in and page reload automatically started watchPosition and posted an extra location | Removed automatic position watching and duplicate frontend ping; separately user-triggered visit/check-out actions remain |
| Check-in map showed a later location | Admin query substituted latest location_pings values for attendance coordinates | Current map/roster use original attendance coordinates only |
| Unknown historical accuracy appeared precise | Attendance history/report borrowed accuracy from the first movement ping | Accuracy is stored on attendance; old unknown values remain null |
| Readable address absent | No reverse-geocoding implementation/configuration existed | Optional server-side self-hosted Nominatim adapter, exact-coordinate cache, rate spacing, timeout, safe failed-result state |
| Delayed addresses would stay stale in Admin | Attendance revision contained only check-in/out timestamps | Revision includes attendance GPS/address fields, so existing automatic refresh also detects resolution |
| Incorrect day boundaries in movement history | UTC date(captured_at) was compared with India attendance dates | India business-day conversion in Admin/self movement queries |
| Duplicate/retry risk | Existing-row check occurred outside the transaction | Recheck under the write transaction; existing unique employee/day key retained; retries never replace original evidence |

## Changes and files

- `shared/check-in-location.mjs` / `.d.mts`: fresh click-triggered capture, explicit error messages, accuracy threshold, coordinate-only map URLs and consistent IST formatting, including UTC midnight rollover.
- `src/components/sales/sales-workspace.tsx`: removed automatic watches; added explicit low-accuracy/no-GPS choices, browser timestamp submission and duplicate recovery. The existing check-in page/theme/navigation remain.
- `server/field-activity.mjs`, `server/check-in-routes.mjs`, `server/app.mjs`: transactional immutable check-in save, original metadata, authenticated self-only API and asynchronous address work after commit. Admin accounts cannot use the employee check-in action; client RM IDs are ignored.
- `database/migrations/019_check_in_location.sql`: nullable attendance metadata, geocoding cache and rate table. Legacy business records are not rewritten/backfilled.
- `server/check-in-geocoder.mjs`: approved/self-hosted Nominatim-compatible endpoint support. Public OSMF Nominatim is excluded, including trailing-dot host spelling. Only valid nearby provider features can resolve; missing fields are never invented. Coarse/unknown GPS does not claim road/locality/postcode precision. Failed lookups retain GPS and become Address unavailable. Recorded pending jobs recover on restart; legacy null-status rows do not become background jobs.
- `server/check-in-location-data.mjs`, `server/admin.mjs`, `server/sales-routes.mjs`, `server/rm-my-day-report.mjs`: original-point current/history projections, original accuracy and India movement dates.
- `server/attendance-revision.mjs`: GPS/address changes participate in the existing authorized automatic Admin monitor, normally within its two-second visible-tab interval. No new tracking channel or infrastructure was added.
- `src/components/admin/check-in-location.tsx`, `salesperson-map.tsx`, `admin-activity.tsx`, `admin-overview.tsx`: readable address/status, actual timestamps, accuracy, exact View Map links, truthful saved-location labels and a history disclosure. Detailed metadata wraps independently of employee names. Map loading/error states keep the readable roster available.
- `src/lib/api.ts`, `src/types/admin.ts`, `src/types/sales.ts`: capture payload and metadata types. Tests and operation/setup documentation were updated.

## Data preservation

All **16 existing attendance records** match the prior full SQLite backup on original ID, employee, business date, check-in/out timestamps and coordinates. There are zero changed/deleted original rows and zero test attendance rows in the active database. All 16 legacy records retain null new capture/accuracy/address metadata rather than inferred evidence. SQLite integrity is `ok`; foreign-key violations remain zero. Migration 019 was applied locally by the existing development API startup mechanism.

See [history preservation evidence](history-preservation.json). The comparison used the existing pre-profile-trigger full backup `data/crm-before-pipeline-profile-triggers-2026-11-20.sqlite`. Automated check-ins were executed only in disposable temporary databases.

## Tests and verification

| Check | Result |
| --- | --- |
| GPS/storage/geocoder/auth/attendance/pipeline unit and HTTP regressions | 30 passed, zero failed; one separate opt-in pipeline browser test skipped |
| Dedicated check-in browser scenario against production build | 1 passed, zero failed/skipped |
| RM V3 report/history regression | 5 passed, zero failed; two optional browser cases skipped |
| TypeScript | Passed |
| Production build | Passed |
| Independent review | Initial provider-validation, host-normalization and pending-job findings fixed; follow-up found no blockers |

The browser test uses **mock Geolocation API results and mock geocoding HTTP replies**, with real authenticated routes and a disposable SQLite database. These results are not real-device GPS verification. It covers simultaneous desktop/mobile RM check-ins, correct per-RM mapping, denied permission without silent save, coarse-fix consent, successful and failed address lookup, exact coordinates in View Map, unchanged historical coordinates, unauthorized Admin-data access, rejected Admin check-in, ignored client userId, duplicate retry, India historical movement boundaries and automatic Admin updates without refresh. Desktop and 390px touch/mobile browser contexts are covered; mobile device hardware/iOS permission behavior is not validated by emulation.

Unit tests additionally cover unavailable/timeout/stale GPS, zero coordinates, original capture timestamps, serialized provider requests/caching, malformed/distant geocoder responses, public-host exclusion, coarse detail suppression, pending-job recovery without historical backfill and IST day rollover. A report regression now explicitly verifies that a legacy attendance record does not borrow accuracy from an unrelated movement ping.

Initial dev-browser reruns hit navigation timeouts during hot reload/external resource loading. Final browser verification used a separate local production preview to avoid that test-environment interference. The preview was stopped after verification. Generated OneDrive build caches were moved aside inside the workspace; user data was not moved/deleted. Existing CSS build warnings remain nonblocking.

Logs: [unit/API tests](unit-api-tests.log), [browser test](browser-tests.log), [report regression](report-regression.log), [TypeScript](typescript.log), [production build](build-final.log). Mock-location screenshots are retained in ignored `scratch/check-in-location/`.

## Remaining configuration and manual verification

1. **Endpoint deferred by the user.** No production/self-hosted geocoder was contacted or provisioned. Configure `CRM_REVERSE_GEOCODE_URL` and identifying User-Agent when your self-hosted Nominatim is ready. Until then, coordinates and View Map work and readable addresses remain unavailable. See [setup and operational limits](../../operations/check-in-location.md).
2. Test actual Android/iPhone/desktop permission prompts on HTTPS, outdoors/indoors accuracy, device clock skew, denied permission, weak signal and real address quality after provider configuration. Browser-reported coordinates are device/browser evidence; the application cannot prove physical presence or prevent client-side location spoofing.
3. Reverse geocoding returns the nearest suitable mapped object, not a guaranteed building/road. The [official behavior](https://nominatim.org/release-docs/latest/api/Reverse/#how-it-works) describes this limitation. The original coordinates and reported uncertainty remain authoritative.
4. For scaled multi-process deployments, enforce provider-wide limits at the self-hosted gateway. Existing single-process queue/SQLite scheduling is the verified setup. Do not send employee GPS to a public alias/proxy; the [public service policy](https://operations.osmfoundation.org/policies/nominatim/) forbids personal/confidential submissions.
5. Production deployment, real-device GPS testing and actual self-hosted address resolution were not performed. Existing Supabase/Tally limitations are unchanged by this location fix.

## Phone screenshot follow-up

The user supplied a phone screenshot of plain HTTP LAN access, a successful no-GPS checkout shown as an error, and a stale Checked In button after checkout. Inspection confirmed that success messages used error state and button text ignored checkedOutAt. Fixed the completed-day label, separate informational attendance notices, duplicate checkout clicks, truthful no-GPS caption and explicit insecure-context GPS messaging. Geolocation requires a trusted HTTPS origin on the phone; no certificate/phone trust or tunnel was installed. The self-hosted address provider remains deferred by agreement.

A new insecure-context unit test first reproduced the missing HTTPS guard and then passed. The browser regression was extended to check GPS and no-GPS checkout, disabled Checked Out controls and absence of error banners on successful saves. Follow-up logs are [unit tests](phone-followup-tests.log), [browser tests](phone-followup-browser.log) and [build](phone-followup-build.log). All GPS/provider inputs in these tests remain mocks.

Phone follow-up verification: 12 unit tests passed, the extended production-build browser scenario passed, standalone TypeScript and production build passed. The temporary preview was stopped. Trusted HTTPS access on the physical phone remains unconfigured; no real-device GPS success is claimed.
