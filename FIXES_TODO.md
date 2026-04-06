# QA Fixes Required

## FIX 1: Pro CSV Export Mismatch (Issue #2)

shared/pricing.ts line ~98 - Change Pro limits.exportFormats from [json, env] to [json, env, csv]

server/subscription-gate.ts line ~144 - Add pro to csv_export array in isFeatureAllowed featureMap
