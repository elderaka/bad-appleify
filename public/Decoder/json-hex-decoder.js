/**
 * Bad Appleify - JSON Hex Format Decoder
 * Decodes JSON files with hex-encoded frame data
 */

/**
 * Load and decode Bad Appleify JSON (Hex) file
 * @param {string} url - URL or path to the JSON file (supports .json and .json.gz)
 * @returns {Promise<Object>} Decoded animation data
 */
async function loadBadAppleHex(url) {
  const response = await fetch(url)
  let arrayBuffer = await response.arrayBuffer()

  // Check for gzip magic bytes (0x1f, 0x8b) and decompress if needed
  const bytes = new Uint8Array(arrayBuffer)
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    // Gzip compressed - decompress using DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
      const blob = new Blob([arrayBuffer])
      const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
      arrayBuffer = await new Response(stream).arrayBuffer()
    } else {
      throw new Error('File is gzip compressed but DecompressionStream API is not available')
    }
  }

  const jsonText = new TextDecoder().decode(arrayBuffer)
  const json = JSON.parse(jsonText)

  // Decode hex strings to Uint8Array
  const frames = json.data.map((hexString) => {
    const bytes = new Uint8Array(hexString.length / 2)
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substr(i, 2), 16)
    }
    return bytes
  })

  return {
    width: json.width,
    height: json.height,
    frames: frames,
    frameCount: json.frames,
    fps: json.fps,
    duration: json.duration,
    bytesPerFrame: json.bytesPerFrame,
  }
}

/**
 * Get pixel value at (x, y) in a frame
 * @param {Uint8Array} frame - Frame data
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Frame width
 * @returns {boolean} true if pixel is white/on, false if black/off
 */
function getPixel(frame, x, y, width) {
  const rowBytes = Math.ceil(width / 8)
  const byteIndex = y * rowBytes + Math.floor(x / 8)
  const bitIndex = x % 8
  const mask = 0x80 >> bitIndex
  return (frame[byteIndex] & mask) !== 0
}

/**
 * Render frame to canvas
 * @param {Uint8Array} frame - Frame data
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {number} width - Frame width
 * @param {number} height - Frame height
 */
function renderFrame(frame, canvas, width, height) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = getPixel(frame, x, y, width)
      const color = pixel ? 255 : 0
      const index = (y * width + x) * 4
      data[index] = color
      data[index + 1] = color
      data[index + 2] = color
      data[index + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// Example usage:
/*
(async () => {
  const animation = await loadBadAppleHex('bad-appleify.json');
  const canvas = document.getElementById('myCanvas');

  let frameIndex = 0;
  setInterval(() => {
    renderFrame(animation.frames[frameIndex], canvas, animation.width, animation.height);
    frameIndex = (frameIndex + 1) % animation.frameCount;
  }, 1000 / animation.fps);
})();
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadBadAppleHex, getPixel, renderFrame }
}
