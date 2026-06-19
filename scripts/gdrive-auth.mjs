#!/usr/bin/env node
/**
 * Run: node scripts/gdrive-auth.mjs [freshsens|gohm]
 * Opens OAuth flow and saves .gdrive-server-credentials.json to the creds dir.
 */
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const account = process.argv[2] || "gohm";
const CREDS_DIR = `/home/cem/temp/sentinel/credentials/${account}`;
const keyfilePath = path.join(CREDS_DIR, "gcp-oauth.keys.json");
const credentialsPath = path.join(CREDS_DIR, ".gdrive-server-credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
];

console.log(`Authenticating Google account: ${account}`);
console.log(`Keyfile: ${keyfilePath}`);
console.log(`Will save credentials to: ${credentialsPath}`);
console.log("");
console.log("A browser window will open. If it doesn't, copy the URL printed below.");
console.log("---");

try {
  const auth = await authenticate({ keyfilePath, scopes: SCOPES });
  const { credentials } = await auth.refreshAccessToken();
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  console.log("✓ Credentials saved successfully.");
  console.log("  Scopes:", credentials.scope);
} catch (err) {
  console.error("Auth failed:", err.message);
  process.exit(1);
}
