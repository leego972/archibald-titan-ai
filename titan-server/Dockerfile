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
RUN mkdir -p /opt/evilginx && \
    wget -q https://github.com/kgretzky/evilginx2/releases/download/v3.3.0/evilginx-v3.3.0-linux-64bit.zip \
        -O /tmp/evilginx.zip && \
    unzip -q /tmp/evilginx.zip -d /opt/evilginx && \
    rm /tmp/evilginx.zip && \
    chmod +x /opt/evilginx/evilginx && \
    ln -sf /opt/evilginx/evilginx /usr/local/bin/evilginx

# Create base directory for Titan users
RUN mkdir -p /opt/titan/users

# Copy startup and Metasploit installer scripts
COPY start.sh /start.sh
COPY install-metasploit.sh /opt/titan/install-metasploit.sh
RUN chmod +x /start.sh /opt/titan/install-metasploit.sh

EXPOSE 22

CMD ["/start.sh"]
