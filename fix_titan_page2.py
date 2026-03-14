with open('/home/ubuntu/archibald-titan-ai/client/src/pages/TitanServerAdminPage.tsx', 'r') as f:
    content = f.read()

# Restore @/ aliases
content = content.replace('from "../lib/queryClient"', 'from "@/lib/queryClient"')
content = content.replace('from "../hooks/use-toast"', 'from "@/hooks/use-toast"')
content = content.replace('from "../components/ui/card"', 'from "@/components/ui/card"')
content = content.replace('from "../components/ui/button"', 'from "@/components/ui/button"')
content = content.replace('from "../components/ui/badge"', 'from "@/components/ui/badge"')

with open('/home/ubuntu/archibald-titan-ai/client/src/pages/TitanServerAdminPage.tsx', 'w') as f:
    f.write(content)

print("Done")
