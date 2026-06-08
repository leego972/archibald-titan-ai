#!/bin/bash
set -e

# Update root password from env var if provided
if [ -n "$ROOT_PASSWORD" ]; then
  echo "root:$ROOT_PASSWORD" | chpasswd
fi

# Ensure SSH host keys exist
ssh-keygen -A

# Create user directories base
mkdir -p /opt/titan/users

# Install Metasploit in background (does not block SSH startup)
/opt/titan/install-metasploit.sh > /var/log/metasploit-install.log 2>&1 &

# Minimal HTTP health server so Railway's health check passes.
# Responds 200 {"ok":true} on $PORT (default 8080). Runs in background.
HEALTH_PORT="${PORT:-8080}"
python3 -c "
import http.server, os
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(b'{"ok":true,"service":"titan-server"}')
    def log_message(self, *a): pass
http.server.HTTPServer(('0.0.0.0', int(os.environ.get('PORT', 8080))), H).serve_forever()
" &

# Start SSH daemon
exec /usr/sbin/sshd -D
