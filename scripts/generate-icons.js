#!/usr/bin/env node
// scripts/generate-icons.js
// Run: node scripts/generate-icons.js
// Requires: npm install canvas (optional, or use manual SVG below)

const fs = require("fs");
const path = require("path");

// Create SVG icons as placeholder
const createSVGIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.1}" fill="#1e40af"/>
  <text x="50%" y="35%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${size * 0.2}" font-family="Arial, sans-serif" font-weight="bold">CBT</text>
  <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#93c5fd" font-size="${size * 0.12}" font-family="Arial, sans-serif">SD/MI</text>
  <path d="M${size*0.3} ${size*0.72} L${size*0.5} ${size*0.62} L${size*0.7} ${size*0.72}" fill="none" stroke="#93c5fd" stroke-width="${size*0.03}" stroke-linecap="round"/>
</svg>`;

const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[192, 512].forEach((size) => {
  fs.writeFileSync(
    path.join(iconsDir, `icon-${size}.svg`),
    createSVGIcon(size)
  );
  console.log(`Created icon-${size}.svg`);
});

console.log("\nNote: For production, replace SVG files with proper PNG icons.");
console.log("You can use tools like: https://www.pwabuilder.com/imageGenerator");
console.log("or: npx pwa-asset-generator logo.png ./public/icons");
