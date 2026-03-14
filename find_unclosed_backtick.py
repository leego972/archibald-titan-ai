#!/usr/bin/env python3
"""Find unclosed backtick template literals in the payload generator."""

path = "/home/ubuntu/archibald-titan-ai/server/marketplace-payload-generator.ts"

with open(path, "r") as f:
    content = f.read()

# Count backticks - if odd number, there's an unclosed one
backtick_count = content.count('`')
print(f"Total backticks: {backtick_count} ({'even - balanced' if backtick_count % 2 == 0 else 'ODD - UNBALANCED'})")

# Find the position of each backtick and track open/close state
in_backtick = False
depth = 0
last_open_line = 0
last_open_pos = 0

lines = content.split('\n')
char_pos = 0

for line_num, line in enumerate(lines, 1):
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == '\\' and i + 1 < len(line):
            i += 2  # skip escaped char
            continue
        if ch == '`':
            if not in_backtick:
                in_backtick = True
                last_open_line = line_num
                last_open_pos = i
            else:
                in_backtick = False
        i += 1

if in_backtick:
    print(f"UNCLOSED BACKTICK at line {last_open_line}, position {last_open_pos}")
    print(f"Context: {lines[last_open_line-1][:100]}")
else:
    print("All backticks are balanced")

# Also check for ${...} patterns that might be causing issues
import re
# Find all ${...} that are NOT escaped
unescaped = [(i+1, m.start(), m.group()) for i, line in enumerate(lines) 
             for m in re.finditer(r'(?<!\\)\$\{', line)]
print(f"\nUnescaped ${{ occurrences: {len(unescaped)}")
for line_num, pos, match in unescaped[:20]:
    print(f"  Line {line_num}: {lines[line_num-1][max(0,pos-10):pos+30]}")
