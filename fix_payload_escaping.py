#!/usr/bin/env python3
"""
Fix all unescaped ${...} in shell/bash code strings inside TypeScript template literals.
The file uses backtick-delimited strings for code content, so any ${...} inside
those strings must be escaped as \${...} to prevent TypeScript from treating them
as template expressions.
"""
import re

path = "/home/ubuntu/archibald-titan-ai/server/marketplace-payload-generator.ts"

with open(path, "r") as f:
    content = f.read()

# We need to find all ${...} that are NOT already escaped (\${)
# and are NOT legitimate TypeScript template expressions (i.e., they are inside
# code strings that are bash/shell variables like ${1:-4444}, ${PORT}, etc.)
#
# Strategy: parse the file character by character tracking whether we are inside
# a backtick string that is a VALUE of a property (i.e., after a colon in an object).
# This is complex, so instead we use a simpler heuristic:
# Any ${...} that contains shell-like content (no JS identifiers with dots/parens)
# should be escaped.
#
# Actually the simplest correct approach: escape ALL ${...} that appear inside
# the code payload strings. The payload strings are the values in the PAYLOADS object.
# We can identify them because they are indented code content.
#
# Simplest approach: replace ${VAR} and ${VAR:-default} patterns that look like
# shell variables (uppercase, or with :-, or with #, %, etc.)

# Pattern: ${ followed by uppercase letters, digits, underscores, or shell operators
# These are shell variables, not TS template expressions
shell_var_pattern = re.compile(r'(?<!\\)\$\{([A-Z_][A-Z0-9_]*(?:[:#%\-\+\?][^}]*)?)?\}')

# Also catch lowercase shell vars like ${port}, ${host}, ${1:-4444}
shell_var_pattern2 = re.compile(r'(?<!\\)\$\{(\d+(?::-[^}]*)?)?\}')
shell_var_pattern3 = re.compile(r'(?<!\\)\$\{([a-z_][a-z0-9_]*(?:[:#%\-\+\?][^}]*)?)?\}')

# Count replacements
count = 0

def escape_shell_var(m):
    global count
    count += 1
    return '\\${' + (m.group(1) or '') + '}'

new_content = shell_var_pattern.sub(escape_shell_var, content)
new_content = shell_var_pattern2.sub(escape_shell_var, new_content)
new_content = shell_var_pattern3.sub(escape_shell_var, new_content)

# But we need to NOT escape legitimate TypeScript template expressions like:
# ${title}, ${listing.title}, ${userId}, etc. that are actual TS variables
# These appear in the TypeScript code itself, not inside the code payload strings.
#
# The above regexes already handle this because:
# - TS template expressions use camelCase like ${title}, ${listing.id} etc.
# - Shell vars use UPPERCASE or have :- operators
# 
# But ${title} in TS would also match shell_var_pattern3...
# Let me be more surgical: only escape if the variable name is ALL_CAPS or has shell operators

# Reset and redo with better patterns
count = 0
new_content = content

# Pattern 1: ALL_CAPS shell vars like ${PORT}, ${HOST}, ${TARGET}
p1 = re.compile(r'(?<!\\)\$\{([A-Z][A-Z0-9_]+)\}')
new_content = p1.sub(lambda m: f'\\${{{m.group(1)}}}', new_content)
count += len(p1.findall(content))

# Pattern 2: Shell vars with operators like ${1:-4444}, ${VAR:-default}, ${#array[@]}
p2 = re.compile(r'(?<!\\)\$\{([^}]*(?::-|:=|:\?|:\+|#|%|##|%%)[^}]*)\}')
new_content = p2.sub(lambda m: f'\\${{{m.group(1)}}}', new_content)
count += len(p2.findall(content))

# Pattern 3: Positional params like ${1}, ${2}, ${@}, ${*}, ${#}
p3 = re.compile(r'(?<!\\)\$\{([@*#]|\d+)\}')
new_content = p3.sub(lambda m: f'\\${{{m.group(1)}}}', new_content)
count += len(p3.findall(content))

with open(path, "w") as f:
    f.write(new_content)

print(f"Fixed {count} shell variable expressions")
print("Done")
