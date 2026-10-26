#!/bin/bash
# Provision the game host with Docker, the closefront user, and Tailscale checks.
# Exit on error
set -e

echo "====================================================="
echo "🚀 STARTING SERVER SETUP"
echo "====================================================="

if ! command -v tailscale > /dev/null 2>&1 || \
    ! ip -o -4 addr show dev tailscale0 > /dev/null 2>&1; then
    echo "❌ ERROR: Tailscale must be installed and connected before setup."
    echo "Join this server to your tailnet, then run setup.sh again."
    exit 1
fi

echo "🔄 Updating system..."
apt update && apt upgrade -y

# Install jq (used by update.sh for asset upload)
if command -v jq &> /dev/null; then
    echo "jq is already installed"
else
    echo "📦 Installing jq..."
    apt install -y jq
fi

# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo "Docker is already installed"
else
    echo "🐳 Installing Docker..."
    # Install Docker using official script
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable --now docker
    echo "Docker installed successfully"
fi

# Remove the metrics stack if an earlier setup installed it.
docker rm -f node-exporter otel-collector > /dev/null 2>&1 || true
rm -rf /home/closefront/otel /home/closefront/otel

echo "👤 Setting up closefront user..."
# Create closefront user if it doesn't exist
if id "closefront" &> /dev/null; then
    echo "User closefront already exists"
else
    useradd -m -s /bin/bash closefront
    echo "User closefront created"
fi

# Check if closefront is already in docker group
if groups closefront | grep -q '\bdocker\b'; then
    echo "User closefront is already in the docker group"
else
    # Add closefront to the docker group
    usermod -aG docker closefront
    echo "Added closefront to the docker group"
fi

# Create .ssh directory for closefront if it doesn't exist
if [ ! -d "/home/closefront/.ssh" ]; then
    mkdir -p /home/closefront/.ssh
    chmod 700 /home/closefront/.ssh
    echo "Created .ssh directory for closefront"
fi

# Copy SSH keys from root if they exist and haven't been copied yet
if [ -f /root/.ssh/authorized_keys ] && [ ! -f /home/closefront/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys /home/closefront/.ssh/
    chmod 600 /home/closefront/.ssh/authorized_keys
    echo "SSH keys copied from root to closefront"
fi

# Configure UDP buffer sizes for Cloudflare Tunnel
# https://github.com/quic-go/quic-go/wiki/UDP-Buffer-Sizes
echo "🔧 Configuring UDP buffer sizes..."
# Check if settings already exist in sysctl.conf
if grep -q "net.core.rmem_max" /etc/sysctl.conf && grep -q "net.core.wmem_max" /etc/sysctl.conf; then
    echo "UDP buffer size settings already configured"
else
    # Add UDP buffer size settings to sysctl.conf
    echo "# UDP buffer size settings for improved QUIC performance" >> /etc/sysctl.conf
    echo "net.core.rmem_max=7500000" >> /etc/sysctl.conf
    echo "net.core.wmem_max=7500000" >> /etc/sysctl.conf

    # Apply the settings immediately
    sysctl -p
    echo "UDP buffer sizes configured and applied"
fi

# Set proper ownership for closefront's home directory
chown -R closefront:closefront /home/closefront
echo "Set proper ownership for closefront's home directory"

echo "====================================================="
echo "🎉 SETUP COMPLETE!"
echo "====================================================="
echo "The closefront user has been set up and has Docker permissions."
echo "UDP buffer sizes have been configured for optimal QUIC/WebSocket performance."
echo "The game container will bind only to the Tailscale IP and configured port."
echo "====================================================="
