#!/bin/bash
set -e
echo 'Applying QA fixes...'

cd "$(dirname "$0")/.."

# Fix 1: Sidebar builder link
sed -i.bak 's|label: "Titan Builder", path: "/builder"|label: "Titan Builder", path: "/dashboard"|' client/src/components/FetcherLayout.tsx
echo 'Fix 1 done: sidebar builder link'

# Fix 2: Credits label
sed -i.bak 's|tracking-widest">Credits<|tracking-widest">Fetches<|' client/src/components/FetcherLayout.tsx
echo 'Fix 2 done: credits label'

# Fix 3a: Pro features list
sed -i.bak 's|JSON, .ENV & CSV export|JSON \& .ENV export|' shared/pricing.ts
echo 'Fix 3a done: pro features list'

# Fix 3b: Comparison matrix
sed -i.bak 's|pro: "JSON, .ENV, CSV"|pro: "JSON, .ENV"|' shared/pricing.ts
echo 'Fix 3b done: comparison matrix'

rm -f client/src/components/FetcherLayout.tsx.bak shared/pricing.ts.bak
echo 'All fixes applied.'
