import re

with open('/home/ubuntu/archibald-titan-ai/client/src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Add link to sidebar
if 'href="/admin/titan-server"' not in content:
    content = content.replace('href="/admin/activity" icon={Activity} label="Activity Log" />', 
                              'href="/admin/activity" icon={Activity} label="Activity Log" />\n              <SidebarLink href="/admin/titan-server" icon={Server} label="Titan Server" />')

with open('/home/ubuntu/archibald-titan-ai/client/src/components/Sidebar.tsx', 'w') as f:
    f.write(content)
