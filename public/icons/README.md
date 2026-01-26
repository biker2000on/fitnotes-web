# Icons

This directory contains app icons for PWA support.

## Current Status
- icon.svg: Base SVG icon (working)
- icon-192.png: TODO - Convert SVG to 192x192 PNG
- icon-512.png: TODO - Convert SVG to 512x512 PNG

## Generate PNG Icons

You can generate PNG icons using:

1. **Online Tools:**
   - https://cloudconvert.com/svg-to-png
   - Upload icon.svg, convert to PNG at 192x192 and 512x512

2. **ImageMagick (if installed):**
   ```bash
   convert icon.svg -resize 192x192 icon-192.png
   convert icon.svg -resize 512x512 icon-512.png
   ```

3. **Sharp (Node.js):**
   ```bash
   npm install sharp
   node ../scripts/generate-icons-sharp.js
   ```

The app will work with SVG as fallback until PNG icons are generated.
