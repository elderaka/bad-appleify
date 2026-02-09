/**
 * Composable for managing frame playback
 */

import { ref, reactive, type Ref } from 'vue'
import type { DebugStats, RenderMeta } from '../types'
import { renderPackedFrameToCanvas, buildPlaybackCache } from '../utils/frameRenderer'

export function usePlayback(
  packedFrames: Ref<Uint8Array[]>,
  renderMeta: RenderMeta,
  playbackCanvasRef: Ref<HTMLCanvasElement | null>,
  videoRef: Ref<HTMLVideoElement | null>,
  drawPreview: () => void,
) {
  const isPlaying = ref(false)
  const currentPlaybackFrame = ref(0)
  const targetFps = ref(30)
  const preRenderedFrames = ref<ImageBitmap[] | null>(null)

  let playbackAnimationId: number | null = null
  let debugLastTick = 0

  const debugStats = reactive<DebugStats>({
    lastFrameIndex: 0,
    lastFrameMs: 0,
    avgFrameMs: 0,
    actualFps: 0,
    lastPreviewMs: 0,
    lastPreviewSource: 'none',
    lastTickDeltaMs: 0,
    lastPlaybackRenderMs: 0,
  })

  let debugFrameCount = 0
  let debugFrameTimeSum = 0

  /**
   * Build cache of pre-rendered frames for smoother playback
   */
  const buildCache = async (): Promise<void> => {
    if (!packedFrames.value.length) return
    preRenderedFrames.value = await buildPlaybackCache(
      packedFrames.value,
      renderMeta.width,
      renderMeta.height,
    )
  }

  /**
   * Start playback animation loop
   */
  const startPlayback = () => {
    if (isPlaying.value || playbackAnimationId !== null) {
      console.log('Already playing')
      return
    }

    if (packedFrames.value.length === 0) {
      console.log('No frames to play')
      return
    }

    console.log('Starting playback...')
    isPlaying.value = true
    const frameDuration = 1000 / targetFps.value

    const playFrame = () => {
      const tickNow = performance.now()
      if (debugLastTick > 0) {
        debugStats.lastTickDeltaMs = tickNow - debugLastTick
      }
      debugLastTick = tickNow
      const frameStart = tickNow

      if (!isPlaying.value) {
        if (playbackAnimationId !== null) {
          clearInterval(playbackAnimationId)
          playbackAnimationId = null
        }
        return
      }

      const width = renderMeta.width
      const height = renderMeta.height

      // Render playback canvas
      const cached = preRenderedFrames.value
      if (cached && currentPlaybackFrame.value < cached.length) {
        const bitmap = cached[currentPlaybackFrame.value]
        const ctx = playbackCanvasRef.value?.getContext('2d')
        if (ctx && bitmap) {
          ctx.imageSmoothingEnabled = false
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(bitmap, 0, 0)
        }
      } else if (currentPlaybackFrame.value < packedFrames.value.length) {
        const frame = packedFrames.value[currentPlaybackFrame.value]
        if (frame) {
          renderPackedFrameToCanvas(frame, playbackCanvasRef.value, width, height)
        }
      }

      debugStats.lastPreviewSource = 'playback'
      currentPlaybackFrame.value += 1

      // Loop back to start
      if (currentPlaybackFrame.value >= packedFrames.value.length) {
        currentPlaybackFrame.value = 0
      }

      const frameEnd = performance.now()
      const frameMs = frameEnd - frameStart
      debugFrameCount += 1
      debugFrameTimeSum += frameMs
      debugStats.lastFrameIndex = currentPlaybackFrame.value
      debugStats.lastFrameMs = frameMs
      debugStats.avgFrameMs = debugFrameTimeSum / debugFrameCount
      debugStats.actualFps = debugStats.avgFrameMs > 0 ? 1000 / debugStats.avgFrameMs : 0
      debugStats.lastPlaybackRenderMs = frameMs
    }

    playbackAnimationId = window.setInterval(playFrame, frameDuration)
  }

  /**
   * Stop playback
   */
  const stopPlayback = () => {
    isPlaying.value = false
    if (playbackAnimationId !== null) {
      clearInterval(playbackAnimationId)
      playbackAnimationId = null
    }
    const video = videoRef.value
    if (video) {
      video.pause()
    }
  }

  /**
   * Toggle playback state
   */
  const togglePlayback = () => {
    if (isPlaying.value) {
      stopPlayback()
    } else {
      const video = videoRef.value
      if (video) {
        video.play().then(() => startPlayback())
      } else {
        startPlayback()
      }
    }
  }

  /**
   * Initialize playback after rendering
   */
  const initializePlayback = async (playbackCanvas: HTMLCanvasElement | null) => {
    if (playbackCanvas) {
      playbackCanvas.width = renderMeta.width
      playbackCanvas.height = renderMeta.height
    }

    // Build cache for playback (no auto-play)
    preRenderedFrames.value = null
    await buildCache()

    currentPlaybackFrame.value = 0
    const video = videoRef.value
    if (video) {
      video.currentTime = 0
    }
  }

  return {
    isPlaying,
    currentPlaybackFrame,
    targetFps,
    debugStats,
    startPlayback,
    stopPlayback,
    togglePlayback,
    initializePlayback,
    buildCache,
  }
}
