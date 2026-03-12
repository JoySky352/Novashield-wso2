#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const command = process.argv[2];

if (command === "init") {
  const configTemplate = `
const config = {
  baseUrl: "https://your-wso2-server.com",
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET", // Optional for public clients
  callbackUrl: "http://localhost:3000/callback",
  autoDiscovery: true, // v2.1.0 feature
  debug: true,         // v2.1.0 feature
  rejectUnauthorized: false // Set to true in production
};

module.exports = config;
`;

  const targetPath = path.join(process.cwd(), "novashield-config.js");

  if (fs.existsSync(targetPath)) {
    console.error("Error: novashield-config.js already exists.");
    process.exit(1);
  }

  fs.writeFileSync(targetPath, configTemplate);
  console.log("✅ Novashield configuration initialized: novashield-config.js");
  console.log("Next steps: Fill in your clientId and baseUrl.");
} else {
  console.log("Novashield SDK CLI");
  console.log("Usage: npx novashield init");
}
