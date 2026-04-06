# QA Audit Fixes

Three single-line fixes remain. See issue #1 for details.

## Fix 1 - Sidebar builder link exits dashboard
File: client/src/components/FetcherLayout.tsx
Find the Titan Builder menu item and change path: /builder to path: /dashboard

## Fix 2 - Header widget mislabeled
File: client/src/components/FetcherLayout.tsx
In the header, find the span that says Credits and change it to Fetches

## Fix 3 - Pro export format mismatch
File: shared/pricing.ts
3A: In Pro features array, change JSON, .ENV and CSV export to JSON and .ENV export
3B: In COMPARISON_FEATURES, change the Pro export row from JSON, .ENV, CSV to JSON, .ENV

## Reason
Fix 1: /builder is a public page, not the dashboard builder
Fix 2: Widget shows fetchesRemaining but labels it Credits (different system)
Fix 3: Backend blocks CSV for Pro users but UI promises it
