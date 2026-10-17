# BoxJS Cookie Capture Switches Implementation Plan

**Goal:** Control daily-signin and WPS credential capture independently from BoxJS, without stopping scheduled or manual sign-in.

**Architecture:** Keep the two existing combined modules. Add a persistent read-only gate at each capture entry point; add its Boolean control to BoxJS. Both default to disabled. Existing credential keys, cron declarations and panel runners remain unchanged. WPS uses a small Surge-specific capture script honoring the upstream `wps_sid` contract; its actual sign-in script remains the author's public script.

**Tech Stack:** Surge scripts/modules, BoxJS JSON, Node VM tests.

**Constraints:** daily cron 07:00; WPS cron 10:00; no account/network actions during tests; no credentials in Git; no automatic clearing or replay; switches are manual and remain enabled until the user turns them off. A disabled gate stops capture writes/notifications, not Surge's matching or MITM processing.

## Steps

- [x] Add regression tests for default-off / explicit-off / on / on-then-off, unchanged credentials, failed writes, and preserved module schedules/panels.
- [x] Add `QX_SIGNIN_CAPTURE_ENABLED` to the existing daily BoxJS app and early-return from capture when disabled. Bump capture resource version in module and example.
- [x] Add `wps/wps.cookie.capture.js` and `wps/boxjs.json` with a dedicated `wps_capture_enabled` control; point only WPS Cookie capture at the gated script. Preserve the author's cron script and existing manual panel.
- [x] Update module descriptions and README instructions: open capture switch, log in, verify capture, close switch; expired sessions require reopening. Keep WPS task settings in the author's subscription.
- [x] Run targeted regression suites and diff checks; commit/push; fetch all changed subscription/resource URLs and compare SHA256.

## Evidence boundaries

Offline tests verify source/configuration and simulated persistence/HTTP behavior. Phone UI, real credential capture and actual scheduled sign-in remain device validation.
