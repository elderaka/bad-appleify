/**
 * Bad Appleify - Binary Format Decoder
 * Decodes raw binary .bin files (most compact format)
 */

/**
 * Load and decode Bad Appleify Binary file
 * Note: You need to know width, height, and frame count beforehand
 * or store them separately (e.g., in filename or companion JSON)
 *
 * @param {string} url - URL or path to the binary file (supports .bin and .bin.gz)
 * @param {number} width - Frame width
 * @param {number} height - Frame height
 * @param {number} frameCount - Number of frames (optional, will calculate from file size)
 * @returns {Promise<Object>} Decoded animation data
 */
async function loadBadAppleBinary(url, width, height, frameCount = null) {
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

  /* ... (gzip decompression logic remains same) ... */
  const data = new Uint8Array(arrayBuffer)

  const bytesPerFrame = Math.ceil(width / 8) * height
  const calculatedFrameCount = frameCount || Math.floor(data.length / bytesPerFrame)

  // OPTIMIZATION: We do NOT split into frames array anymore.
  // We keep the single flat Uint8Array buffer to save memory.
  // JS arrays of TypedArrays have massive overhead.

  return {
    width: width,
    height: height,
    data: data, // Flat buffer
    frameCount: calculatedFrameCount,
    bytesPerFrame: bytesPerFrame,
  }
}

/**
 * Get pixel value at (x, y) in a specific frame
 * @param {Uint8Array} data - The ENTIRE animation data buffer
 * @param {number} frameIndex - The frame number to read
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Frame width
 * @param {number} height - Frame height
 * @returns {boolean} true if pixel is white/on, false if black/off
 */
function getPixel(data, frameIndex, x, y, width, height) {
  const bytesPerFrame = Math.ceil(width / 8) * height
  const frameStart = frameIndex * bytesPerFrame

  const rowBytes = Math.ceil(width / 8)
  const localByteIndex = y * rowBytes + Math.floor(x / 8)
  const bitIndex = x % 8

  const absoluteByteIndex = frameStart + localByteIndex

  if (absoluteByteIndex >= data.length) return false

  const mask = 0x80 >> bitIndex
  return (data[absoluteByteIndex] & mask) !== 0
}

/**
 * Render frame to canvas
 * @param {Uint8Array} data - The ENTIRE animation data buffer
 * @param {number} frameIndex - The frame number to render
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {number} width - Frame width
 * @param {number} height - Frame height
 */
function renderFrame(data, frameIndex, canvas, width, height) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  const pixelData = imageData.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = getPixel(data, frameIndex, x, y, width, height)
      const color = pixel ? 255 : 0
      const index = (y * width + x) * 4
      pixelData[index] = color
      pixelData[index + 1] = color
      pixelData[index + 2] = color
      pixelData[index + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// Example usage:
/*
(async () => {
  // You must specify width, height, and optionally frame count
  const animation = await loadBadAppleBinary('bad-appleify.bin', 128, 128, 6322);
  const canvas = document.getElementById('myCanvas');

  let frameIndex = 0;
  setInterval(() => {
    // New API: Pass implementation data, frame index, canvas, width, height
    renderFrame(animation.data, frameIndex, canvas, animation.width, animation.height);
    frameIndex = (frameIndex + 1) % animation.frameCount;
  }, 1000 / 30); // Assuming 30 fps
})();
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadBadAppleBinary, getPixel, renderFrame }
}
