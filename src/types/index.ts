/**
 * Type definitions for Bad Appleify
 */

export interface RenderMeta {
  width: number
  height: number
  duration: number
  frames: number
  fps: number
  bytesPerFrame: number
}

export interface DebugStats {
  lastFrameIndex: number
  lastFrameMs: number
  avgFrameMs: number
  actualFps: number
  lastPreviewMs: number
  lastPreviewSource: PreviewSource
  lastTickDeltaMs: number
  lastPlaybackRenderMs: number
}

export type PreviewSource = 'none' | 'playback' | 'slider' | 'invert'

export interface RenderProgress {
  current: number
  total: number
  elapsedMs: number
  estimatedTotalMs: number
  renderFps: number
  finished: boolean
}

export interface ExportMeta {
  title: string
  source: string
  width: number
  height: number
  frames: number
  duration: number
  fps: number
  threshold: number
  invert: boolean
  bytesPerFrame: number
  packing: string
  encoding?: string
}

export interface WorkerMessage {
  type: 'INIT' | 'PACK_FRAME' | 'READY' | 'FRAME_PACKED' | 'ERROR'
  payload?: PackFramePayload | FramePackedPayload | ErrorPayload
}

export interface PackFramePayload {
  frameData: Uint8ClampedArray
  width: number
  height: number
  threshold: number
  invert: boolean
  frameIndex: number
}

export interface FramePackedPayload {
  frameIndex: number
  packed: Uint8Array
}

export interface ErrorPayload {
  message: string
}
