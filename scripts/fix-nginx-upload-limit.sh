#!/usr/bin/env bash

# Script to fix nginx upload limit on server
# Run this on the SERVER (reels.hurated.com)

set -e

echo "=== Finding nginx configuration ==="
echo ""

# Find nginx config
NGINX_CONF=$(sudo find /etc /usr/local/etc -name "nginx.conf" -o -name "*reels*.conf" 2>/dev/null | head -1)

if [ -z "$NGINX_CONF" ]; then
    echo "Could not find nginx config automatically."
    echo "Please locate it manually and add these lines to the server block:"
    echo ""
    echo "    client_max_body_size 200M;"
    echo "    proxy_connect_timeout 300s;"
    echo "    proxy_send_timeout 300s;"
    echo "    proxy_read_timeout 300s;"
    echo ""
    echo "Common locations:"
    echo "  - /etc/nginx/nginx.conf"
    echo "  - /etc/nginx/sites-available/reels.hurated.com"
    echo "  - /etc/nginx/conf.d/reels.hurated.com.conf"
    echo "  - Control panel configs (Plesk, cPanel, etc.)"
    exit 1
fi

echo "Found nginx config: $NGINX_CONF"
echo ""

# Check current settings
echo "=== Current settings ==="
sudo grep -i "client_max_body_size" "$NGINX_CONF" || echo "  client_max_body_size: not set (default 1M)"
sudo grep -i "proxy.*timeout" "$NGINX_CONF" || echo "  proxy timeouts: not set"
echo ""

# Offer to create backup
read -p "Create backup? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✓ Backup created"
fi

echo ""
echo "=== Instructions ==="
echo ""
echo "Add or update these settings in the server block:"
echo ""
echo "    # For video uploads"
echo "    client_max_body_size 200M;"
echo ""
echo "    # Inside location / block:"
echo "    proxy_connect_timeout 300s;"
echo "    proxy_send_timeout 300s;"
echo "    proxy_read_timeout 300s;"
echo ""
echo "Then reload nginx:"
echo "    sudo nginx -t"
echo "    sudo systemctl reload nginx"
echo ""
echo "Or edit now:"
echo "    sudo nano $NGINX_CONF"
echo ""
