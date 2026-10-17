# Surge 5 migration implementation plan

**Goal:** Publish a native Surge version of Tizzy-3/quantumultX in Tizzy-3/Surge.

**Architecture:** Preserve the current sign-in workflows and adapt only runtime APIs and installation resources. Use native Surge HTTP, persistent storage and notifications; use the WebView engine for CryptoJS secure randomness. Keep existing QX_SIGNIN_ setting keys for manual BoxJS migration, with independent subscription IDs.

**Tech stack:** JavaScript, Surge modules, Node.js built-in test runner.

## Constraints

- Source revision: 954d7aae85f8f1248eb779888777635b221cbaa3.
- Target: Surge iOS 5.9+; no changes to the QX repository.
- Credentials stay on device; do not make live sign-in or webhook requests in tests.
- Record the source revision and copy images; replace QX installation files with native Surge files.

## Tasks

- [x] Adapt surge_signin.js: callback HTTP to Promise, milliseconds to seconds, normalize status/body, preserve cookie merging; native storage/notification APIs. Use native request timeout without clearTimeout dependence.
- [x] Adapt surge_cookie_capture.js: native storage/notifications; request and response capture; always finish with an empty object without rewriting traffic.
- [x] Create DailySignIn.sgmodule and surge.conf.example: cron at local 08:00, wake-system, 300-second timeout, WebView; bounded IMYAI response capture; append MITM hosts.
- [x] Update boxjs.json and README: independent subscription IDs, preserved setting keys, installation links, recapture instructions, version floor, source provenance and validation boundaries.
- [x] Add meaningful offline tests in tests/surge.test.cjs. Run node --test, node --check for both scripts, and git diff --check. Cover native API contracts, capture persistence, completion, HTTP error/timeout/retry behavior, real CryptoJS/pako loading in an isolated WebView-like context and module resource consistency.
- [x] Inspect the complete diff and prepare the publication file set with module/BoxJS URLs. Do not claim device validation.

## Verification

Runtime APIs, credential capture, redirects, resource consistency and actual dependency loading are tested offline. No live account actions or device validation are performed. The dependency test reads local files supplied through SURGE_TEST_VENDOR_DIR; without it, only that test is skipped.
