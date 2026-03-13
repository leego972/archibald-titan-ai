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
    golang \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH
RUN mkdir /var/run/sshd
RUN echo 'root:titan123!' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# SSH login fix. Otherwise user is kicked off after login
RUN sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd

ENV NOTVISIBLE "in users profile"
RUN echo "export VISIBLE=now" >> /etc/profile

# Install Metasploit
RUN curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > msfinstall && \
    chmod 755 msfinstall && \
    ./msfinstall

# Install Evilginx3 (download binary)
RUN mkdir -p /opt/evilginx && \
    cd /opt/evilginx && \
    wget https://github.com/kgretzky/evilginx2/releases/download/3.3.0/evilginx-linux-amd64.tar.gz && \
    tar -xvf evilginx-linux-amd64.tar.gz && \
    rm evilginx-linux-amd64.tar.gz

# Create base directory for Titan users
RUN mkdir -p /opt/titan/users

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
