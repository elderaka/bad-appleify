import type { RenderMeta } from '../types'

export interface UploadedBinaryMeta {
  width: number
  height: number
  fps: number
  frames: Uint8Array[]
  frameCount: number
}

export interface ResolutionCandidate {
  width: number
  height: number
  aspectRatio: string
}

export function parseFilename(
  filename: string,
): { width: number; height: number; fps: number } | null {
  const match = filename.match(/(\d+)x(\d+)@(\d+)/)
  if (match) {
    return {
      width: parseInt(match[1]!),
      height: parseInt(match[2]!),
      fps: parseInt(match[3]!),
    }
  }
  return null
}

export function detectPossibleResolutions(fileSize: number): ResolutionCandidate[] {
  const candidates: ResolutionCandidate[] = []
  const commonAspects = [
    { w: 16, h: 9, name: '16:9' },
    { w: 4, h: 3, name: '4:3' },
    { w: 1, h: 1, name: '1:1' },
    { w: 3, h: 4, name: '3:4' },
    { w: 9, h: 16, name: '9:16' },
  ]

  for (const aspect of commonAspects) {
    for (let scale = 4; scale <= 120; scale++) {
      const width = aspect.w * scale
      const height = aspect.h * scale
      const bytesPerFrame = Math.ceil(width / 8) * height

      if (fileSize % bytesPerFrame === 0) {
        const frames = fileSize / bytesPerFrame
        if (frames > 10 && frames < 10000) {
          candidates.push({
            width,
            height,
            aspectRatio: aspect.name,
          })
        }
      }
    }
  }

  return candidates.slice(0, 10)
}

export async function loadBinaryFile(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'undefined') {
      const blob = new Blob([arrayBuffer])
      const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
      const decompressed = await new Response(stream).arrayBuffer()
      return new Uint8Array(decompressed)
    } else {
      throw new Error('File is gzip compressed but DecompressionStream API is not available')
    }
  }

  return bytes
}

// Removed decodeFrames as we now use flat buffers

export function getPixel(frame: Uint8Array, x: number, y: number, width: number): boolean {
  const rowBytes = Math.ceil(width / 8)
  const byteIndex = y * rowBytes + Math.floor(x / 8)
  const bitIndex = x % 8
  const mask = 0x80 >> bitIndex
  return (frame[byteIndex]! & mask) !== 0
}

export function getPixelFromBuffer(
  data: Uint8Array,
  frameIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const bytesPerFrame = Math.ceil(width / 8) * height
  const frameStart = frameIndex * bytesPerFrame
  const rowBytes = Math.ceil(width / 8)

  // Calculate relative position within the frame
  const localByteIndex = y * rowBytes + Math.floor(x / 8)
  const bitIndex = x % 8

  const absoluteByteIndex = frameStart + localByteIndex

  // Bounds check (optional but good for safety)
  if (absoluteByteIndex >= data.length) return false

  const mask = 0x80 >> bitIndex
  return (data[absoluteByteIndex]! & mask) !== 0
}
