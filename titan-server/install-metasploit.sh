#!/bin/bash
# Install Metasploit Framework on first use
# This runs in the background after the server starts

if command -v msfconsole &> /dev/null; then
    echo "Metasploit already installed"
    exit 0
fi

echo "Installing Metasploit Framework..."
curl -fsSL https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > /tmp/msfinstall
chmod 755 /tmp/msfinstall
/tmp/msfinstall
rm /tmp/msfinstall
echo "Metasploit installation complete"
