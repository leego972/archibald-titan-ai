# beta7 VIBA Migration Notes

beta7 now uses the VIBA / BridgeAI orchestration feature as its primary feature source.

## What was changed

- Added `public/beta7-logo.svg`.
- Updated `client/src/pages/VIBAPage.tsx` so the user-facing product name is beta7.
- Retained the existing `bridge_ai` subscription feature flag to avoid breaking current plan-gating logic.
- Retained `VITE_BRIDGE_AI_URL` as a fallback environment variable for backwards compatibility.
- Added `VITE_BETA7_URL` as the preferred new environment variable.
- Removed user-facing VIBA naming from the orchestration page.
- Added Zippyfixer-style beta-test positioning: scan, log, reproduce, classify, report, then repair only behind paid access.

## Current access route

The existing route `/bridge` still points to the renamed beta7 page. This avoids breaking existing dashboard navigation.

Recommended next patch:

- Add `/beta7` route as an alias to the same page.
- Keep `/bridge` as a backwards-compatible redirect or alias.
- Rename sidebar/menu label from VIBA or BridgeAI to beta7 wherever it appears.

## Environment variables

Preferred:

```env
VITE_BETA7_URL=
```

Backwards-compatible fallback:

```env
VITE_BRIDGE_AI_URL=
```

Do not use bypass-token access for the standalone beta7 paid app. All repair/build/deploy actions must remain behind subscription/license gates.

## Feature-source rule

- Primary source: VIBA / BridgeAI multi-agent orchestration.
- Secondary source: Zippyfixer beta-test, scan, log, report, and repair concepts only where useful.
- Final public branding: beta7.
