/**
 * Image processing utilities
 */

/**
 * Calculate luminance from RGB values using ITU-R BT.601 formula
 */
export const luminance = (r: number, g: number, b: number): number =>
  0.299 * r + 0.587 * g + 0.114 * b

/**
 * Get a single bit from a packed frame at the specified x,y position
 * @param frame - Packed frame data (1 bit per pixel, 8 pixels per byte)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param width - Frame width in pixels
 * @returns 0 or 1
 */
export const getBit = (frame: Uint8Array, x: number, y: number, width: number): number => {
  const rowBytes = Math.ceil(width / 8)
  const byteIndex = y * rowBytes + Math.floor(x / 8)
  const bitIndex = x % 8
  const mask = 0x80 >> bitIndex
  return (frame[byteIndex]! & mask) !== 0 ? 1 : 0
}

/**
 * Draw a binarized preview of a video frame onto a canvas
 * @param video - Source video element
 * @param sourceCanvas - Hidden canvas for capturing video frames
 * @param previewCanvas - Visible canvas for displaying preview
 * @param threshold - Luminance threshold (0-255)
 * @param invert - Whether to invert the output
 * @returns Time taken in milliseconds
 */
export const drawBinarizedPreview = (
  video: HTMLVideoElement,
  sourceCanvas: HTMLCanvasElement,
  previewCanvas: HTMLCanvasElement,
  threshold: number,
  invert: boolean,
): number => {
  const t0 = performance.now()

  if (video.videoWidth === 0 || video.videoHeight === 0) return 0

  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const previewContext = previewCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceContext || !previewContext) return 0

  sourceContext.drawImage(video, 0, 0, sourceCanvas.width, sourceCanvas.height)
  const frame = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const output = previewContext.createImageData(sourceCanvas.width, sourceCanvas.height)
  const data = frame.data
  const out = output.data

  for (let i = 0; i < data.length; i += 4) {
    const lum = luminance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)
    const isWhite = lum >= threshold
    const value = invert ? (isWhite ? 0 : 1) : isWhite ? 1 : 0
    const color = value === 1 ? 255 : 0
    out[i] = color
    out[i + 1] = color
    out[i + 2] = color
    out[i + 3] = 255
  }

  previewContext.putImageData(output, 0, 0)
  return performance.now() - t0
}
