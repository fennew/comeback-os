// Simple script to generate PWA icons as SVG (browsers accept SVG for PWA icons on most platforms)
// For production, replace these with proper designed PNG icons

const fs = require('fs');
const path = require('path');

function generateSVGIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#0a0a0a"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="${size * 0.35}" fill="#f59e0b">C</text>
  <text x="50%" y="78%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-weight="500" font-size="${size * 0.1}" fill="#999">OS</text>
</svg>`;
}

const publicDir = path.join(__dirname, '..', 'public');

// Write SVG files (will be used as icons)
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), generateSVGIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), generateSVGIcon(512));

console.log('Icons generated');
