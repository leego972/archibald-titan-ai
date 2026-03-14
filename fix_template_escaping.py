#!/usr/bin/env python3
"""
Fix unescaped ${ inside TypeScript template literal strings.
Lines that are valid TS template expressions (${title}, ${description}, ${listing.*}, ${Math.*}, ${updated}, ${skipped}, ${errors})
should NOT be escaped. Everything else inside a backtick string should be escaped.
"""

import re

with open("/home/ubuntu/archibald-titan-ai/server/marketplace-payload-generator.ts") as f:
    content = f.read()

# Lines to fix (1-indexed) and what to replace
# We'll do targeted replacements for each problematic line

fixes = [
    # Line 121: shell variable in listener.sh
    ("${1:-4444}", r"\${1:-4444}"),
    # Line 508-509: JWT token construction
    ("${h}.${p}.${this.base64url(sig)}", r"\${h}.\${p}.\${this.base64url(sig)}"),
    ("${h}.${p}`", r"\${h}.\${p}`"),
    # Line 539
    ("`${h}.${p}`", r"`\${h}.\${p}`"),
    # Line 1124
    ("${prefix}${msg}", r"\${prefix}\${msg}"),
    # Line 1132
    ("${this.constructor.name}", r"\${this.constructor.name}"),
    # Line 1144
    ("${result.duration}", r"\${result.duration}"),
    # Line 1155
    ("${error.message}", r"\${error.message}"),
    # Line 1174
    ("${level.toUpperCase()} ${message}", r"\${level.toUpperCase()} \${message}"),
    # Line 1739
    ("${pairs.length}", r"\${pairs.length}"),
    # Line 1744
    ("${opp.spread_pct}% | Buy on ${opp.buy_on}", r"\${opp.spread_pct}% | Buy on \${opp.buy_on}"),
    # Line 2627
    ("${err}", r"\${err}"),
    # Line 3310
    ("${target}", r"\${target}"),
    ("${context.userId}", r"\${context.userId}"),
    # Lines 3668, 3691, 3719 - GitHub Actions YAML ${{ env.NODE_VERSION }}
    ("${{ env.NODE_VERSION }}", r"\${{ env.NODE_VERSION }}"),
    # Line 3740-3742 - GitHub Actions secrets
    ("${{ secrets.RAILWAY_SERVICE }}", r"\${{ secrets.RAILWAY_SERVICE }}"),
    ("${{ secrets.RAILWAY_TOKEN }}", r"\${{ secrets.RAILWAY_TOKEN }}"),
]

original = content
for find, replace in fixes:
    content = content.replace(find, replace)

changes = sum(1 for f, r in fixes if f in original)
print(f"Applied {changes} fixes")

with open("/home/ubuntu/archibald-titan-ai/server/marketplace-payload-generator.ts", "w") as f:
    f.write(content)

print("Done")
