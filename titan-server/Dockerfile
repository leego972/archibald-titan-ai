FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies and SSH server
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
RUN mkdir /var/run/sshd
RUN echo 'root:titan123' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
RUN sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# SSH login fix
RUN sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd

ENV NOTVISIBLE "in users profile"
RUN echo "export VISIBLE=now" >> /etc/profile

# Install Metasploit Framework via official installer
RUN curl -fsSL https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > /tmp/msfinstall && \
    chmod 755 /tmp/msfinstall && \
    /tmp/msfinstall

# Install Evilginx3 (correct release URL - zip format)
RUN mkdir -p /opt/evilginx && \
    cd /opt/evilginx && \
    wget -q https://github.com/kgretzky/evilginx2/releases/download/v3.3.0/evilginx-v3.3.0-linux-64bit.zip && \
    unzip -q evilginx-v3.3.0-linux-64bit.zip && \
    rm evilginx-v3.3.0-linux-64bit.zip && \
    chmod +x /opt/evilginx/evilginx && \
    ln -sf /opt/evilginx/evilginx /usr/local/bin/evilginx

# Create base directory for Titan users
RUN mkdir -p /opt/titan/users

# Startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 22

CMD ["/start.sh"]
