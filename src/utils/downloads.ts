/**
 * Download utilities for exporting packed frames in various formats
 */

import type { ExportMeta, RenderMeta } from '../types'
import { bytesToHex, bytesToBase64, formatBytes } from './formatters'
import { getBit } from './imageProcessing'

/**
 * Create and trigger a file download
 */
const downloadBlob = (content: string | Uint8Array, filename: string, type: string): void => {
  const blob = new Blob([content as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Build common export metadata
 */
export const buildExportMeta = (
  fileName: string,
  renderMeta: RenderMeta,
  threshold: number,
  invert: boolean,
): ExportMeta => ({
  title: 'Bad Apple',
  source: fileName,
  width: renderMeta.width,
  height: renderMeta.height,
  frames: renderMeta.frames,
  duration: renderMeta.duration,
  fps: Number(renderMeta.fps.toFixed(3)),
  threshold,
  invert,
  bytesPerFrame: renderMeta.bytesPerFrame,
  packing: 'row-major, MSB-first per byte, padded to next byte per row',
})

/**
 * Download frames as JSON with hex-encoded frame data
 */
export const downloadJson = (packedFrames: Uint8Array[], meta: ExportMeta): void => {
  console.time('downloadJson')
  const hexFrames = packedFrames.map((frame) => bytesToHex(frame))
  const data = { ...meta, data: hexFrames }
  const json = JSON.stringify(data)
  console.log(`JSON size: ${formatBytes(json.length)}`)
  downloadBlob(json, 'bad-appleify.json', 'application/json')
  console.timeEnd('downloadJson')
}

/**
 * Download frames as JSON with base64-encoded frame data
 */
export const downloadJsonBase64 = (packedFrames: Uint8Array[], meta: ExportMeta): void => {
  console.time('downloadJsonBase64')
  const base64Frames = packedFrames.map((frame) => bytesToBase64(frame))
  const data = { ...meta, encoding: 'base64', data: base64Frames }
  const json = JSON.stringify(data)
  console.log(`JSON size: ${formatBytes(json.length)}`)
  downloadBlob(json, 'bad-appleify.base64.json', 'application/json')
  console.timeEnd('downloadJsonBase64')
}

/**
 * Download frames as gzipped JSON with base64 encoding
 */
export const downloadJsonGzip = async (
  packedFrames: Uint8Array[],
  meta: ExportMeta,
): Promise<void> => {
  if (typeof CompressionStream === 'undefined') {
    // Fallback to regular base64 if compression not supported
    downloadJsonBase64(packedFrames, meta)
    return
  }

  const base64Frames = packedFrames.map((frame) => bytesToBase64(frame))
  const data = { ...meta, encoding: 'base64', data: base64Frames }
  const json = JSON.stringify(data)
  const blob = new Blob([json], { type: 'application/json' })
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
  const gzBlob = await new Response(stream).blob()
  const url = URL.createObjectURL(gzBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'bad-appleify.base64.json.gz'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Download all frames as a single binary file
 */
export const downloadBinary = (packedFrames: Uint8Array[]): void => {
  const total = packedFrames.reduce((sum, frame) => sum + frame.length, 0)
  const all = new Uint8Array(total)
  let offset = 0
  for (const frame of packedFrames) {
    all.set(frame, offset)
    offset += frame.length
  }
  downloadBlob(all, 'bad-appleify.bin', 'application/octet-stream')
}

/**
 * Download all frames as a gzipped binary file
 */
export const downloadBinaryGzip = async (packedFrames: Uint8Array[], renderMeta: RenderMeta): Promise<void> => {
  if (typeof CompressionStream === 'undefined') {
    downloadBinary(packedFrames)
    return
  }

  const total = packedFrames.reduce((sum, frame) => sum + frame.length, 0)
  const all = new Uint8Array(total)
  let offset = 0
  for (const frame of packedFrames) {
    all.set(frame, offset)
    offset += frame.length
  }

  const blob = new Blob([all], { type: 'application/octet-stream' })
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
  const gzBlob = await new Response(stream).blob()
  const url = URL.createObjectURL(gzBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bad-apple-${renderMeta.width}x${renderMeta.height}@${Math.round(renderMeta.fps)}.bin.gz`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Download as Arduino-compatible C header file
 */
export const downloadHeader = (packedFrames: Uint8Array[], renderMeta: RenderMeta): void => {
  console.time('downloadHeader')
  const totalBytes = packedFrames.reduce((sum, f) => sum + f.length, 0)
  console.log(`Generating C header with ${totalBytes.toLocaleString()} bytes...`)

  const bytes: string[] = new Array(totalBytes)
  let idx = 0

  packedFrames.forEach((frame) => {
    for (let i = 0; i < frame.length; i++) {
      bytes[idx++] = `0x${frame[i]!.toString(16).padStart(2, '0')}`
    }
  })

  console.log('Building header string...')
  const header = [
    '#pragma once',
    '#include <Arduino.h>',
    '',
    `#define BAD_APPLE_WIDTH ${renderMeta.width}`,
    `#define BAD_APPLE_HEIGHT ${renderMeta.height}`,
    `#define BAD_APPLE_FRAMES ${renderMeta.frames}`,
    `#define BAD_APPLE_BYTES_PER_FRAME ${renderMeta.bytesPerFrame}`,
    '',
    'const uint8_t BAD_APPLE_FRAMES_DATA[] PROGMEM = {',
    `  ${bytes.join(', ')}`,
    '};',
    '',
  ].join('\n')

  console.log(`Header size: ${formatBytes(header.length)}`)
  downloadBlob(header, 'bad-appleify.h', 'text/x-c')
  console.timeEnd('downloadHeader')
}

/**
 * Download a decoder file from the public directory
 */
export const downloadDecoder = async (filename: string): Promise<void> => {
  try {
    const response = await fetch(`/Decoder/${filename}`)
    const content = await response.text()
    downloadBlob(content, filename, 'text/javascript')
  } catch (error) {
    console.error('Failed to load decoder:', error)
  }
}
