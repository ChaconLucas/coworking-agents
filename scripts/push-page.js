'use strict';
// copies what the notices page shares with the app (strings, icons, font) into docs/push, served by GitHub Pages
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'docs', 'push');
const COPIES = { 'i18n.js': 'public/js/i18n.js', 'icon-192.png': 'public/icon-192.png', 'icon-512.png': 'public/icon-512.png', 'apple-touch-icon.png': 'public/apple-touch-icon.png', 'fonts/silkscreen-700.woff2': 'public/fonts/silkscreen-700.woff2', 'fonts/OFL.txt': 'public/fonts/OFL.txt' };
if (require.main === module) {
  for (const [to, from] of Object.entries(COPIES)) { fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true }); fs.copyFileSync(path.join(root, from), path.join(out, to)); }
  console.log('docs/push updated');
}
module.exports = { COPIES, out, root };
