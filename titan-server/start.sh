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

# Start SSH daemon
exec /usr/sbin/sshd -D
