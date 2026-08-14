# Miko Phone Quote Bot optimization review

Reviewed: 2026-08-15 (Asia/Taipei)

## Applied
- Added a shared atomic JSON writer (`src/json-file.js`) using a same-directory temporary file followed by rename.
- Switched `docs/phones.json`, `docs/history.json`, `docs/status.json`, and `state/last-prices.json` writes to atomic replacement.
- Changed daily history bucketing from runner UTC dates to `Asia/Taipei`, preventing runs between 00:00–07:59 Taiwan time from being recorded under the previous calendar day.
- Corrected the stale workflow comment that said scheduled runs were not working; current GitHub Actions schedule execution is active.
- Added a non-notifying validation workflow that runs JavaScript syntax checks plus parser/date smoke tests.

## Validation
- Existing scheduled workflow is active and recent scheduled runs complete successfully.
- The new validation workflow completed successfully; syntax, parser, and Taiwan-date smoke tests all passed.
- No manual notification workflow was triggered during this review, so no extra LINE alert was sent by the review process.

## Intentionally deferred
- Token/API-key hardening and credential rotation (deferred by owner request).
