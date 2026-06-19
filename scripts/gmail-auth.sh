#!/bin/bash
# Authenticate Gmail for both FreshSens and GOHM accounts
# Run this script once after enabling Gmail API in both GCP projects

echo "=== Authenticating Gmail for FreshSens ==="
GMAIL_OAUTH_PATH=/home/cem/temp/sentinel/credentials/freshsens/gcp-oauth.keys.json \
GMAIL_CREDENTIALS_PATH=/home/cem/temp/sentinel/credentials/freshsens/gmail-credentials.json \
npx @mjamei/gmail-mcp auth

echo ""
echo "=== Authenticating Gmail for GOHM ==="
GMAIL_OAUTH_PATH=/home/cem/temp/sentinel/credentials/gohm/gcp-oauth.keys.json \
GMAIL_CREDENTIALS_PATH=/home/cem/temp/sentinel/credentials/gohm/gmail-credentials.json \
npx @mjamei/gmail-mcp auth
