import re

with open('/home/ubuntu/archibald-titan-ai/client/src/App.tsx', 'r') as f:
    content = f.read()

# Add import
if 'import TitanServerAdminPage' not in content:
    content = content.replace('import AdminActivityLogPage from "./pages/AdminActivityLogPage";', 
                              'import AdminActivityLogPage from "./pages/AdminActivityLogPage";\nimport TitanServerAdminPage from "./pages/TitanServerAdminPage";')

# Add route
if '<Route path="/admin/titan-server"' not in content:
    content = content.replace('<Route path="/admin/activity" component={AdminActivityLogPage} />', 
                              '<Route path="/admin/activity" component={AdminActivityLogPage} />\n        <Route path="/admin/titan-server" component={TitanServerAdminPage} />')

with open('/home/ubuntu/archibald-titan-ai/client/src/App.tsx', 'w') as f:
    f.write(content)
