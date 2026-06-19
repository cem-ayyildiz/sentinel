#!/bin/bash
# Authenticate Google Calendar for both FreshSens and GOHM accounts
# Run this script once after enabling Calendar API in both GCP projects

echo "=== Authenticating Calendar for FreshSens ==="
GOOGLE_OAUTH_CREDENTIALS=/home/cem/temp/sentinel/credentials/freshsens/gcp-oauth.keys.json \
GOOGLE_CALENDAR_MCP_TOKEN_PATH=/home/cem/temp/sentinel/credentials/freshsens/calendar-token.json \
npx @cocal/google-calendar-mcp auth

echo ""
echo "=== Authenticating Calendar for GOHM ==="
GOOGLE_OAUTH_CREDENTIALS=/home/cem/temp/sentinel/credentials/gohm/gcp-oauth.keys.json \
GOOGLE_CALENDAR_MCP_TOKEN_PATH=/home/cem/temp/sentinel/credentials/gohm/calendar-token.json \
npx @cocal/google-calendar-mcp auth
