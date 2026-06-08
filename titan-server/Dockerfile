FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install all dependencies and SSH server in one layer
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    nmap \
    net-tools \
    iputils-ping \
    dnsutils \
    jq \
    unzip \
    ruby \
    ruby-dev \
    build-essential \
    libssl-dev \
    libreadline-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH
RUN mkdir /var/run/sshd && \
    echo 'root:titan123' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd

ENV NOTVISIBLE "in users profile"
RUN echo "export VISIBLE=now" >> /etc/profile

# Install Evilginx3 v3.3.0 — non-fatal: download failure won't break the build.
# Evilginx can be installed at runtime if the build-time download fails.
RUN mkdir -p /tmp/evilginx-extract /opt/evilginx && \
    ( curl -fsSL --retry 3 --retry-delay 5 --max-time 120 \
          https://github.com/kgretzky/evilginx2/releases/download/v3.3.0/evilginx-v3.3.0-linux-64bit.zip \
          -o /tmp/evilginx.zip && \
      unzip -q /tmp/evilginx.zip -d /tmp/evilginx-extract && \
      find /tmp/evilginx-extract -name "evilginx" -type f | head -1 | xargs -I{} cp {} /usr/local/bin/evilginx && \
      chmod +x /usr/local/bin/evilginx && \
      ln -sf /usr/local/bin/evilginx /opt/evilginx/evilginx && \
      rm -rf /tmp/evilginx.zip /tmp/evilginx-extract ) || \
    echo "Warning: Evilginx download failed — install manually at runtime with /opt/titan/install-evilginx.sh"

# Create base directory for Titan users
RUN mkdir -p /opt/titan/users

# Copy startup and Metasploit installer scripts
COPY start.sh /start.sh
COPY install-metasploit.sh /opt/titan/install-metasploit.sh
RUN chmod +x /start.sh /opt/titan/install-metasploit.sh

# Railway needs an HTTP port to confirm the service is alive.
# We expose both SSH (22) and the health-check port (default 8080).
EXPOSE 22 8080

CMD ["/start.sh"]
