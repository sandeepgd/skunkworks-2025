#!/bin/bash

set -euo pipefail
LOGFILE="/var/log/my-startup.log"
exec > >(tee -a "$LOGFILE") 2>&1

# Update system packages
sudo yum update -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing Docker..."
    sudo yum install -y docker git
    sudo service docker start
    sudo usermod -a -G docker ec2-user
else
    echo "Docker is already installed"
fi

# Install Docker Compose if not already installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose not found. Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose is already installed"
fi

# Create app directory and clone repo if not exists
sudo -u ec2-user bash -c 'cd /home/ec2-user && if [ ! -d "skunkworks-2025" ]; then
    echo "Repository not found. Cloning skunkworks-2025..."
    git clone https://github.com/sandeepgd/skunkworks-2025.git
    cd /home/ec2-user/skunkworks-2025
else
    echo "Repository already exists. Updating..."
    cd /home/ec2-user/skunkworks-2025
    git pull
fi'

# Create .env file
# TODO: Paste your environment variables here
sudo -u ec2-user bash -c 'cat > /home/ec2-user/skunkworks-2025/.env << EOL
EOL'

# Check if .env file is empty
if [ ! -s /home/ec2-user/skunkworks-2025/.env ]; then
    echo "Error: .env file is empty. Please add your environment variables."
    exit 1
fi

# Check if containers are already running
cd /home/ec2-user/skunkworks-2025
if sudo -u ec2-user docker-compose ps --services --filter "status=running" | grep -q "app"; then
    echo "Containers are already running. Skipping docker-compose up."
else
    echo "Starting containers..."
    sudo -u ec2-user docker-compose up --build -d
fi

# Print status
echo "Application deployment completed!"
echo "Check the logs with: docker-compose logs -f" 