# Bad Appleify Decoder Functions

This folder contains decoder functions and examples for each export format from Bad Appleify.

## 📦 Available Formats & Decoders

### 1. **Binary (.bin / .bin.gz)** - 🏆 RECOMMENDED

- **Size**: Smallest (~1-2 MB uncompressed, ~500 KB gzipped)
- **Decoder**: `binary-decoder.js` (auto-detects gzip)
- **Best for**: Web apps, embedded systems, maximum performance

### 2. **JSON Base64 (.json / .json.gz)**

- **Size**: Medium (~3-4 MB uncompressed, ~1.5 MB gzipped)
- **Decoder**: `json-base64-decoder.js` (auto-detects gzip)
- **Best for**: APIs, easy parsing, good compression

### 3. **JSON Hex (.json / .json.gz)**

- **Size**: Large (~6-8 MB uncompressed, ~2 MB gzipped)
- **Decoder**: `json-hex-decoder.js` (auto-detects gzip)
- **Best for**: Human-readable format, debugging

### 4. **C Header (.h)**

- **Size**: Very large (~10-20 MB)
- **Example**: `arduino-example.ino`
- **Best for**: Arduino/ESP32 microcontrollers with PROGMEM

## 🎨 Demos

### Table Demo (`table-demo.html`)

Interactive 64×48 cell-based visualization:

- Drag & drop `.bin.gz` file
- Each table cell = one pixel
- Play/pause/reset controls
- Retro ASCII-style display

## 🚀 Quick Start

### JavaScript/Web (Binary Format)

```javascript
// Include the decoder
import { loadBadAppleBinary, renderFrame } from './binary-decoder.js'

// Load and play
const animation = await loadBadAppleBinary('bad-appleify.bin', 128, 128)
const canvas = document.getElementById('canvas')

let frame = 0
setInterval(() => {
  renderFrame(animation.frames[frame], canvas, animation.width, animation.height)
  frame = (frame + 1) % animation.frameCount
}, 1000 / 30) // 30 fps
```

### Arduino/ESP32

```cpp
#include "bad-appleify.h"

// See arduino-example.ino for complete code
```

## 📊 Format Comparison

| Format      | Size (128×128, 6000 frames) | Parse Speed | Gzip Support | Use Case   |
| ----------- | --------------------------- | ----------- | ------------ | ---------- |
| Binary      | ~1.5 MB                     | ⚡ Instant  | ✅ Yes       | Production |
| Base64      | ~2 MB                       | ⚡ Fast     | ✅ Yes       | APIs       |
| Base64+Gzip | ~1.8 MB                     | ⚡ Fast     | ✅ Built-in  | Downloads  |
| Hex JSON    | ~6 MB                       | 🐢 Slow     | ✅ Yes       | Debug      |
| C Header    | ~15 MB                      | N/A         | ❌ No        | Hardware   |

**Note**: All JavaScript decoders automatically detect and decompress gzipped files!

## 🎯 Data Format

All formats use **bit-packing**:

- 8 pixels per byte
- MSB-first per byte
- Row-major order
- Padded to next byte per row

**Example**: For 10-pixel width:

- Row uses 2 bytes (10 pixels = 2 bytes)
- Pixels 0-7 in byte 0 (MSB to LSB)
- Pixels 8-9 in byte 1 (top 2 bits)

## 📖 Documentation

Each decoder file contains:

- ✅ Full implementation
- ✅ Usage examples
- ✅ API documentation
- ✅ Pixel extraction functions

## 🔧 Common Functions

All decoders provide these functions:

```javascript
loadBadApple*(url, ...params)  // Load file
getPixel(frame, x, y, width)   // Get pixel value
renderFrame(frame, canvas, w, h) // Render to canvas
```

## 💡 Tips

1. **For web apps**: Use Binary or Base64+Gzip
2. **For offline devices**: Use Binary or C Header
3. **For data science**: Use CSV (but expect long load times)
4. **For human inspection**: Use JSON Hex

## 🤝 Contributing

Found a better decoder implementation? Submit a PR!
