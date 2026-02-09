/**
 * Frame rendering utilities for packed 1-bit frames
 *
 * Frame format: Row-major, MSB-first per byte, padded to next byte per row
 * Each byte contains 8 horizontal pixels, white = 1, black = 0
 */

import { calcBytesPerRow } from './formatters'

/**
 * Pre-computed lookup table for byte to RGBA conversion
 * Maps each byte value (0-255) to 8 pixels worth of RGBA data
 */
export const byteToRgba = (() => {
  const table = new Uint8ClampedArray(256 * 8 * 4) // 256 bytes × 8 pixels × 4 channels
  for (let b = 0; b < 256; b += 1) {
    for (let bit = 0; bit < 8; bit += 1) {
      const isOn = (b & (0x80 >> bit)) !== 0
      const color = isOn ? 255 : 0
      const offset = (b * 8 + bit) * 4
      table[offset] = color // R
      table[offset + 1] = color // G
      table[offset + 2] = color // B
      table[offset + 3] = 255 // A
    }
  }
  return table
})()

// Cached ImageData for reuse
let cachedImageData: ImageData | null = null
let cachedSize = { w: 0, h: 0 }

/**
 * Get or create a cached ImageData object for the given dimensions
 */
const getCachedImageData = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ImageData => {
  if (!cachedImageData || cachedSize.w !== width || cachedSize.h !== height) {
    cachedImageData = ctx.createImageData(width, height)
    cachedSize = { w: width, h: height }
  }
  return cachedImageData
}

/**
 * Reset the cached ImageData (call when dimensions change)
 */
export const resetFrameCache = (): void => {
  cachedImageData = null
  cachedSize = { w: 0, h: 0 }
}

/**
 * Convert a packed 1-bit frame to RGBA ImageData
 * Uses the pre-computed lookup table for fast conversion
 */
export const frameToImageData = (
  frame: Uint8Array,
  imageData: ImageData,
  width: number,
  height: number,
): void => {
  const data = imageData.data
  const rowBytes = calcBytesPerRow(width)

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes
    const pixelRowStart = y * width * 4

    for (let bx = 0; bx < rowBytes; bx += 1) {
      const byte = frame[rowStart + bx] ?? 0
      const srcOffset = byte * 32 // 8 pixels × 4 channels
      const pixelStart = pixelRowStart + bx * 8 * 4
      const remainingPixels = Math.min(8, width - bx * 8)

      if (remainingPixels === 8) {
        // Fast path: copy all 8 pixels at once
        data.set(byteToRgba.subarray(srcOffset, srcOffset + 32), pixelStart)
      } else {
        // Slow path: copy partial byte (last byte in row)
        for (let bit = 0; bit < remainingPixels; bit += 1) {
          const src = srcOffset + bit * 4
          const dst = pixelStart + bit * 4
          data[dst] = byteToRgba[src]!
          data[dst + 1] = byteToRgba[src + 1]!
          data[dst + 2] = byteToRgba[src + 2]!
          data[dst + 3] = 255
        }
      }
    }
  }
}

/**
 * Render a packed 1-bit frame directly to a canvas
 */
export const renderPackedFrameToCanvas = (
  frame: Uint8Array,
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): void => {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const imageData = getCachedImageData(ctx, width, height)
  frameToImageData(frame, imageData, width, height)
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Build a cache of pre-rendered ImageBitmaps for smooth playback
 */
export const buildPlaybackCache = async (
  packedFrames: Uint8Array[],
  width: number,
  height: number,
): Promise<ImageBitmap[] | null> => {
  if (!packedFrames.length) return null
  if (typeof createImageBitmap === 'undefined') return null

  const rowBytes = calcBytesPerRow(width)
  const total = packedFrames.length
  const cached: ImageBitmap[] = new Array(total)

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) return null

  for (let f = 0; f < total; f += 1) {
    const frame = packedFrames[f]!
    const imageData = ctx.createImageData(width, height)
    frameToImageData(frame, imageData, width, height)
    cached[f] = await createImageBitmap(imageData)
  }

  return cached
}
