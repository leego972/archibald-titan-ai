import os
import re

def fix_router(filepath):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r') as f:
        content = f.read()
        
    # We don't want to change the "if (!db) return [];" lines because they are valid error handling
    # We want to check if there are any actual stubs that just return [] instead of querying the DB
    
    # Check for empty array returns that aren't part of an error check
    stubs = re.findall(r'return \[\];\s*// TODO', content)
    if stubs:
        print(f"Found stubs in {filepath}")
        
    # Let's look for any function that just returns [] or null without doing anything else
    empty_funcs = re.findall(r'\.query\(async \(\{.*?\}\) => \{\s*const db = await getDb\(\);\s*if \(!db\) return \[\];\s*return \[\];\s*\}\)', content)
    if empty_funcs:
        print(f"Found empty functions in {filepath}")

routers = [
    'advertising-router.ts',
    'content-creator-router.ts',
    'marketing-router.ts',
    'v2-features-router.ts',
    'v3-features-router.ts',
    'v4-features-router.ts',
    'v5-features-router.ts'
]

for router in routers:
    fix_router(f'/home/ubuntu/repo-clone/server/{router}')
