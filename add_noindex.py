#!/usr/bin/env python3
"""Add useNoIndex hook to all auth/utility pages."""
import re, os

BASE = "/home/ubuntu/archibald-titan-ai/client/src/pages"

# Pages that need noindex + the first useEffect/useState import line to patch
PAGES = {
    "VerifyEmailPage.tsx": {
        "import_line": 'import { useEffect, useState } from "react";',
        "hook_call_after": "const [, navigate] = useLocation();",
        "hook_import": "useNoIndex",
    },
    "ResetPasswordPage.tsx": {
        "import_line": 'import { useState, useEffect } from "react";',
        "hook_call_after": "const [, navigate] = useLocation();",
        "hook_import": "useNoIndex",
    },
    "ForgotPasswordPage.tsx": {
        "import_line": 'import { useState } from "react";',
        "hook_call_after": "const [, navigate] = useLocation();",
        "hook_import": "useNoIndex",
    },
    "DesktopLoginPage.tsx": {
        "import_line": 'import { useState } from "react";',
        "hook_call_after": "const [desktopVersion, setDesktopVersion] = useState",
        "hook_import": "useNoIndex",
    },
}

NOINDEX_IMPORT = 'import { useNoIndex } from "@/hooks/useNoIndex";\n'
HOOK_CALL = "  useNoIndex();\n"

for filename, cfg in PAGES.items():
    path = os.path.join(BASE, filename)
    if not os.path.exists(path):
        print(f"SKIP (not found): {path}")
        continue

    with open(path, "r") as f:
        content = f.read()

    # Skip if already patched
    if "useNoIndex" in content:
        print(f"SKIP (already patched): {filename}")
        continue

    # Add import after the first import line
    import_line = cfg["import_line"]
    if import_line in content:
        content = content.replace(import_line, import_line + "\n" + NOINDEX_IMPORT, 1)
    else:
        # Fallback: add after last import block
        last_import = max(content.rfind('\nimport '), 0)
        end_of_import = content.find('\n', last_import + 1)
        content = content[:end_of_import + 1] + NOINDEX_IMPORT + content[end_of_import + 1:]

    # Add hook call inside the component function
    hook_after = cfg["hook_call_after"]
    if hook_after in content:
        # Find the line and add useNoIndex() after it
        idx = content.find(hook_after)
        end_of_line = content.find('\n', idx)
        content = content[:end_of_line + 1] + HOOK_CALL + content[end_of_line + 1:]
    else:
        # Fallback: add after first opening brace of default export function
        match = re.search(r'export default function \w+\([^)]*\)\s*\{', content)
        if match:
            idx = match.end()
            content = content[:idx] + "\n" + HOOK_CALL + content[idx:]

    with open(path, "w") as f:
        f.write(content)
    print(f"PATCHED: {filename}")

# Also patch LoginPage and RegisterPage (named exports, different structure)
for filename, first_hook_line in [
    ("LoginPage.tsx", "  const { login } = useAuth();"),
    ("RegisterPage.tsx", "  const { register } = useAuth();"),
]:
    path = os.path.join(BASE, filename)
    if not os.path.exists(path):
        print(f"SKIP (not found): {path}")
        continue

    with open(path, "r") as f:
        content = f.read()

    if "useNoIndex" in content:
        print(f"SKIP (already patched): {filename}")
        continue

    # Add import
    content = content.replace('import React, { useState } from "react";',
                               'import React, { useState } from "react";\n' + NOINDEX_IMPORT, 1)

    # Add hook call
    if first_hook_line in content:
        idx = content.find(first_hook_line)
        end_of_line = content.find('\n', idx)
        content = content[:end_of_line + 1] + HOOK_CALL + content[end_of_line + 1:]

    with open(path, "w") as f:
        f.write(content)
    print(f"PATCHED: {filename}")

print("Done.")
