/**
 * Formatting utilities for bytes and data conversion
 */

/**
 * Convert bytes array to hexadecimal string
 */
export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

/**
 * Convert bytes array to base64 string
 * Uses chunking to avoid call stack overflow for large arrays
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Format bytes to human-readable string (B, KB, MB)
 */
export const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Calculate bytes per row for a given width (8 pixels per byte)
 */
export const calcBytesPerRow = (width: number): number => Math.ceil(width / 8)

/**
 * Calculate total packed size for a frame
 */
export const calcPackedSize = (width: number, height: number): number =>
  calcBytesPerRow(width) * height

/**
 * Clamp and floor a value to specified range
 */
export const clampSize = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(value)))
