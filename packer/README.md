# Bad Appleify CLI

Fast Rust-based video to binary converter for Bad Apple animations.

## Features

- 🚀 **Hardware-accelerated** video decoding via FFmpeg
- ⚡ **Multi-threaded** frame processing
- 💾 **Memory efficient** streaming output
- 🎯 **Frame-perfect** extraction (no skipped frames)
- 🖥️ **Works offline** - no browser dependency

## Installation

### Prerequisites

- Rust 1.70+ (`rustup` recommended)
- FFmpeg 4.0+ development libraries

**Windows:**

```powershell
# Install FFmpeg via vcpkg or download from ffmpeg.org
# Set FFMPEG_DIR environment variable if needed
```

**macOS:**

```bash
brew install ffmpeg
```

**Linux:**

```bash
# Ubuntu/Debian
sudo apt install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev

# Fedora
sudo dnf install ffmpeg-devel
```

### Build

```bash
cd packer
cargo build --release --bin bad-appleify
```

The binary will be at `target/release/bad-appleify.exe` (Windows) or `target/release/bad-appleify` (Unix).

## Usage

### Basic Usage

```bash
bad-appleify -i input.mp4 -o output.bin
```

### With Custom Settings

```bash
bad-appleify \
  --input bad_apple.mp4 \
  --output bad_apple_64x48.bin \
  --width 64 \
  --height 48 \
  --threshold 128 \
  --invert
```

### All Options

```
Options:
  -i, --input <INPUT>          Input video file path
  -o, --output <OUTPUT>        Output binary file path [default: output.bin]
  -w, --width <WIDTH>          Target width [default: 128]
  -h, --height <HEIGHT>        Target height [default: 96]
  -t, --threshold <THRESHOLD>  Threshold (0-255) [default: 128]
      --invert                 Invert colors
  -f, --fps <FPS>              Target FPS (0 = native) [default: 0]
  -j, --threads <THREADS>      Processing threads (0 = auto) [default: 0]
      --help                   Print help
```

## Examples

### Low Resolution (64x48)

```bash
bad-appleify -i video.mp4 -o tiny.bin -w 64 -h 48
```

### High Resolution (256x192)

```bash
bad-appleify -i video.mp4 -o hires.bin -w 256 -h 192
```

### Force 30 FPS

```bash
bad-appleify -i video.mp4 -o output.bin -f 30
```

### Inverted Colors

```bash
bad-appleify -i video.mp4 -o inverted.bin --invert
```

### Max Performance (16 threads)

```bash
bad-appleify -i video.mp4 -o output.bin -j 16
```

## Output Format

The output is a **bit-packed binary file**:

- 8 pixels per byte
- MSB-first per byte
- Row-major order
- Padded to byte boundary per row

**Bytes per frame** = `⌈width / 8⌉ × height`

**Total file size** = `bytes_per_frame × frame_count`

## Decoding

Use the JavaScript decoders in `public/Decoder/`:

- `binary-decoder.js` - Full documentation
- `table-demo.html` - Interactive demo

## Performance Comparison

| Method               | 6000 frames @ 128x96 | Notes                           |
| -------------------- | -------------------- | ------------------------------- |
| **Rust CLI**         | ~15-30 seconds       | Hardware decode, multi-threaded |
| Browser (focused)    | ~60-90 seconds       | requestVideoFrameCallback       |
| Browser (background) | ❌ Skipped frames    | Tab throttling                  |

## Integration with Web UI

The Vue app can generate CLI commands for users:

```typescript
const command = `bad-appleify -i "${videoFile}" -o output.bin -w ${width} -h ${height} -t ${threshold}${invert ? ' --invert' : ''}`
```

Or use **Tauri** to call the binary directly from the web UI.

## Troubleshooting

### "FFmpeg not found"

- **Windows**: Set `FFMPEG_DIR` environment variable to FFmpeg installation path
- **macOS/Linux**: Ensure FFmpeg dev packages are installed

### "Codec not supported"

Use a common codec (H.264/H.265):

```bash
ffmpeg -i input.mov -c:v libx264 -pix_fmt yuv420p output.mp4
```

### Performance tuning

```bash
# Use all CPU cores
bad-appleify -i video.mp4 -o output.bin -j 0

# Limit to 4 threads (reduce CPU usage)
bad-appleify -i video.mp4 -o output.bin -j 4
```

## License

Same as parent project.
