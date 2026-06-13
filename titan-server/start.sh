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
# Includes retry logic to handle transient "Address already in use" errors.
sleep 1
python3 -c "
import http.server, os, socket, time, sys

port = int(os.environ.get('PORT', 8080))
print(f'[health] Starting health server on 0.0.0.0:{port}', flush=True)

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(b'{\"ok\":true,\"service\":\"titan-server\"}')
    def log_message(self, *a): pass

class ReusableHTTPServer(http.server.HTTPServer):
    allow_reuse_address = True
    allow_reuse_port = True
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        except (AttributeError, OSError):
            pass
        super().server_bind()

for attempt in range(5):
    try:
        server = ReusableHTTPServer(('0.0.0.0', port), H)
        print(f'[health] Listening on 0.0.0.0:{port}', flush=True)
        server.serve_forever()
    except OSError as e:
        print(f'[health] Attempt {attempt+1}/5 failed: {e}', flush=True)
        if attempt < 4:
            time.sleep(2)
        else:
            print('[health] FATAL: Could not start health server', flush=True)
            sys.exit(1)
" &

# Give the health server a moment to bind before starting sshd
sleep 1

# Start SSH daemon
exec /usr/sbin/sshd -D
