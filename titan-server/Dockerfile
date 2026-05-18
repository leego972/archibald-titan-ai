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

# Install Evilginx3 v3.3.0
# Uses curl (follows GitHub CDN redirects) with 3 retries.
# Extracts to a temp dir; find locates the binary regardless of ZIP layout.
RUN mkdir -p /tmp/evilginx-extract /opt/evilginx && \
    curl -fsSL --retry 3 --retry-delay 5 \
        https://github.com/kgretzky/evilginx2/releases/download/v3.3.0/evilginx-v3.3.0-linux-64bit.zip \
        -o /tmp/evilginx.zip && \
    unzip -q /tmp/evilginx.zip -d /tmp/evilginx-extract && \
    find /tmp/evilginx-extract -name "evilginx" -type f | head -1 | xargs -I{} cp {} /usr/local/bin/evilginx && \
    chmod +x /usr/local/bin/evilginx && \
    ln -sf /usr/local/bin/evilginx /opt/evilginx/evilginx && \
    rm -rf /tmp/evilginx.zip /tmp/evilginx-extract

# Create base directory for Titan users
RUN mkdir -p /opt/titan/users

# Copy startup and Metasploit installer scripts
COPY start.sh /start.sh
COPY install-metasploit.sh /opt/titan/install-metasploit.sh
RUN chmod +x /start.sh /opt/titan/install-metasploit.sh

EXPOSE 22

CMD ["/start.sh"]
