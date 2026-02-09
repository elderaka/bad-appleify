/**
 * Composable for managing frame rendering with Web Worker and concurrent processing
 */

import { ref, reactive, type Ref } from 'vue'
import type { RenderMeta, RenderProgress, WorkerMessage } from '../types'

export function useFrameRenderer(
  videoRef: Ref<HTMLVideoElement | null>,
  sourceCanvasRef: Ref<HTMLCanvasElement | null>,
  renderMeta: RenderMeta,
  threshold: Ref<number>,
  invert: Ref<boolean>,
  targetFps: Ref<number>,
) {
  const isRendering = ref(false)
  const renderProgress = reactive<RenderProgress>({
    current: 0,
    total: 0,
    elapsedMs: 0,
    estimatedTotalMs: 0,
    renderFps: 0,
    finished: false,
  })
  const packedFrames = ref<Uint8Array[]>([])

  let packerWorker: Worker | null = null

  /**
   * Create a new Worker for frame packing
   */
  const createWorker = (): Worker => {
    const worker = new Worker(new URL('../packer.worker.ts', import.meta.url), { type: 'module' })
    worker.postMessage({ type: 'INIT' })
    return worker
  }

  /**
   * Initialize the primary Web Worker for frame packing
   */
  const initWorker = () => {
    if (packerWorker) return
    packerWorker = createWorker()
  }

  /**
   * Cleanup the Web Worker
   */
  const cleanupWorker = () => {
    if (packerWorker) {
      packerWorker.terminate()
      packerWorker = null
    }
  }

  const waitForVideoReady = (video: HTMLVideoElement) =>
    new Promise<void>((resolve, reject) => {
      if (video.readyState >= 2) {
        resolve()
        return
      }

      const onReady = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error('Hidden video failed to load'))
      }
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onReady)
        video.removeEventListener('error', onError)
      }

      video.addEventListener('loadedmetadata', onReady)
      video.addEventListener('error', onError)
    })

  const createHiddenVideo = (source: HTMLVideoElement, startTime = 0) => {
    const srcUrl = source.currentSrc || source.src
    if (!srcUrl) return null

    const hidden = document.createElement('video')
    hidden.src = srcUrl
    hidden.muted = true
    hidden.playsInline = true
    hidden.preload = 'auto'
    hidden.crossOrigin = source.crossOrigin || 'anonymous'
    hidden.currentTime = startTime
    // Keep completely hidden
    hidden.style.display = 'none'

    document.body.appendChild(hidden)
    return hidden
  }

  /**
   * Render a segment with frame-by-frame seeking (frame-perfect, background-safe)
   */
  const renderSegmentSeek = async (
    sourceVideo: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
    segmentIndex: number,
    startFrame: number,
    endFrame: number,
    targetFpsValue: number,
    thresholdValue: number,
    invertValue: boolean,
    segmentWorker: Worker,
    onFramePacked: () => void,
  ): Promise<Map<number, Uint8Array>> => {
    const hiddenVideo = createHiddenVideo(sourceVideo, 0)
    if (!hiddenVideo) {
      throw new Error(`Failed to create hidden video for segment ${segmentIndex}`)
    }

    try {
      await waitForVideoReady(hiddenVideo)
    } catch (error) {
      hiddenVideo.remove()
      throw error
    }

    return new Promise<Map<number, Uint8Array>>((resolve, reject) => {
      const segmentFrames = new Map<number, Uint8Array>()
      const segmentCanvas = document.createElement('canvas')
      segmentCanvas.width = sourceCanvas.width
      segmentCanvas.height = sourceCanvas.height
      const segmentContext = segmentCanvas.getContext('2d', { willReadFrequently: true })

      if (!segmentContext) {
        hiddenVideo.remove()
        reject(new Error('Failed to get canvas context'))
        return
      }

      const expectedFrames = endFrame - startFrame
      let processedFrames = 0
      let postingComplete = false

      const workerHandler = (event: MessageEvent<WorkerMessage>) => {
        const { type, payload } = event.data
        if (type === 'FRAME_PACKED' && payload) {
          const { frameIndex, packed } = payload as { frameIndex: number; packed: Uint8Array }
          if (frameIndex >= startFrame && frameIndex < endFrame) {
            if (!segmentFrames.has(frameIndex)) {
              segmentFrames.set(frameIndex, packed)
              onFramePacked()
              processedFrames += 1

              if (postingComplete && processedFrames >= expectedFrames) {
                cleanup()
                resolve(segmentFrames)
              }
            }
          }
        }
      }

      segmentWorker.addEventListener('message', workerHandler)

      const cleanup = () => {
        segmentWorker.removeEventListener('message', workerHandler)
        hiddenVideo.remove()
      }

      const seekToTime = (time: number) =>
        new Promise<void>((resolveSeek, rejectSeek) => {
          const onSeeked = () => {
            cleanupSeek()
            resolveSeek()
          }
          const onError = () => {
            cleanupSeek()
            rejectSeek(new Error('Hidden video seek failed'))
          }
          const cleanupSeek = () => {
            hiddenVideo.removeEventListener('seeked', onSeeked)
            hiddenVideo.removeEventListener('error', onError)
          }

          hiddenVideo.addEventListener('seeked', onSeeked, { once: true })
          hiddenVideo.addEventListener('error', onError, { once: true })
          hiddenVideo.currentTime = time
        })

      const processFrames = async () => {
        for (let frameIndex = startFrame; frameIndex < endFrame; frameIndex += 1) {
          const targetTime = frameIndex / targetFpsValue
          await seekToTime(targetTime)

          segmentContext.drawImage(hiddenVideo, 0, 0, segmentCanvas.width, segmentCanvas.height)
          const frameData = segmentContext.getImageData(
            0,
            0,
            segmentCanvas.width,
            segmentCanvas.height,
          )

          segmentWorker.postMessage(
            {
              type: 'PACK_FRAME',
              payload: {
                frameData: frameData.data,
                width: segmentCanvas.width,
                height: segmentCanvas.height,
                threshold: thresholdValue,
                invert: invertValue,
                frameIndex,
              },
            },
            [frameData.data.buffer],
          )
        }

        postingComplete = true
        if (processedFrames >= expectedFrames) {
          cleanup()
          resolve(segmentFrames)
        }
      }

      processFrames().catch((error) => {
        cleanup()
        reject(error)
      })
    })
  }

  const renderSegment1 = (
    sourceVideo: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
    startFrame: number,
    endFrame: number,
    targetFpsValue: number,
    thresholdValue: number,
    invertValue: boolean,
    segmentWorker: Worker,
    onFramePacked: () => void,
  ) =>
    renderSegmentSeek(
      sourceVideo,
      sourceCanvas,
      0,
      startFrame,
      endFrame,
      targetFpsValue,
      thresholdValue,
      invertValue,
      segmentWorker,
      onFramePacked,
    )

  const renderSegment2 = (
    sourceVideo: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
    startFrame: number,
    endFrame: number,
    targetFpsValue: number,
    thresholdValue: number,
    invertValue: boolean,
    segmentWorker: Worker,
    onFramePacked: () => void,
  ) =>
    renderSegmentSeek(
      sourceVideo,
      sourceCanvas,
      1,
      startFrame,
      endFrame,
      targetFpsValue,
      thresholdValue,
      invertValue,
      segmentWorker,
      onFramePacked,
    )

  const renderSegment3 = (
    sourceVideo: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
    startFrame: number,
    endFrame: number,
    targetFpsValue: number,
    thresholdValue: number,
    invertValue: boolean,
    segmentWorker: Worker,
    onFramePacked: () => void,
  ) =>
    renderSegmentSeek(
      sourceVideo,
      sourceCanvas,
      2,
      startFrame,
      endFrame,
      targetFpsValue,
      thresholdValue,
      invertValue,
      segmentWorker,
      onFramePacked,
    )

  const renderSegment4 = (
    sourceVideo: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
    startFrame: number,
    endFrame: number,
    targetFpsValue: number,
    thresholdValue: number,
    invertValue: boolean,
    segmentWorker: Worker,
    onFramePacked: () => void,
  ) =>
    renderSegmentSeek(
      sourceVideo,
      sourceCanvas,
      3,
      startFrame,
      endFrame,
      targetFpsValue,
      thresholdValue,
      invertValue,
      segmentWorker,
      onFramePacked,
    )

  /**
   * Render with 4 concurrent segments
   */
  const renderConcurrent = async (
    sourceVideo: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
    targetFpsValue: number,
    thresholdValue: number,
    invertValue: boolean,
  ): Promise<void> => {
    const startTime = performance.now()
    const totalFrames = Math.max(1, Math.floor(renderMeta.duration * targetFpsValue))
    renderProgress.total = totalFrames

    const numSegments = 4
    const framesPerSegment = Math.ceil(totalFrames / numSegments)

    console.log(
      `Starting concurrent render: ${totalFrames} frames across ${numSegments} segments (seeking)`,
    )

    let packedCount = 0

    // Create progress tracking based on video playback
    const progressInterval = setInterval(() => {
      const now = performance.now()
      const elapsed = now - startTime
      renderProgress.elapsedMs = elapsed
      // Update estimated time based on percentage completion
      if (renderProgress.current > 0) {
        renderProgress.estimatedTotalMs = (elapsed / renderProgress.current) * totalFrames
      }
    }, 200)

    try {
      // Create 4 workers for concurrent rendering
      const workers = [createWorker(), createWorker(), createWorker(), createWorker()]

      // Render segments concurrently
      const segmentPromises: Promise<Map<number, Uint8Array>>[] = []
      const onFramePacked = () => {
        packedCount += 1
        renderProgress.current = Math.min(packedCount, totalFrames)
      }
      const segmentConfigs = [
        { render: renderSegment1, index: 0 },
        { render: renderSegment2, index: 1 },
        { render: renderSegment3, index: 2 },
        { render: renderSegment4, index: 3 },
      ]

      segmentConfigs.forEach((config) => {
        const startFrame = config.index * framesPerSegment
        const endFrame = Math.min((config.index + 1) * framesPerSegment, totalFrames)
        const workerForSegment = workers[config.index]!

        segmentPromises.push(
          config
            .render(
              sourceVideo,
              sourceCanvas,
              startFrame,
              endFrame,
              targetFpsValue,
              thresholdValue,
              invertValue,
              workerForSegment,
              onFramePacked,
            )
            .then((segmentFrames) => {
              console.log(`Segment ${config.index} complete: ${segmentFrames.size} frames`)
              return segmentFrames
            }),
        )
      })

      // Wait for all segments
      const results = await Promise.all(segmentPromises)

      // Cleanup workers
      workers.forEach((w) => w.terminate())

      clearInterval(progressInterval)

      // Merge frames
      const mergedFrames: Uint8Array[] = []
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        for (const segmentMap of results) {
          if (segmentMap.has(frameIndex)) {
            mergedFrames.push(segmentMap.get(frameIndex)!)
            break
          }
        }
      }

      packedFrames.value = mergedFrames
      renderMeta.frames = packedFrames.value.length
      renderMeta.fps = renderMeta.duration > 0 ? packedFrames.value.length / renderMeta.duration : 0
      renderMeta.bytesPerFrame = Math.ceil(renderMeta.width / 8) * renderMeta.height
      renderProgress.current = totalFrames
      renderProgress.finished = true

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      console.log(`Render complete: ${packedFrames.value.length} frames in ${elapsed}s`)
    } catch (error) {
      clearInterval(progressInterval)
      console.error('Concurrent render failed:', error)
      throw error
    } finally {
      isRendering.value = false
    }
  }

  /**
   * Render and pack all frames from the video
   */
  const handleRender = async (): Promise<void> => {
    const video = videoRef.value
    const sourceCanvas = sourceCanvasRef.value
    if (!video || !sourceCanvas) return
    if (video.readyState < 2) return

    initWorker()
    if (!packerWorker) return

    // Snapshot config values at render start time
    const thresholdValue = threshold.value
    const invertValue = invert.value
    const targetFpsValue = targetFps.value

    packedFrames.value = []
    renderProgress.current = 0
    renderProgress.total = 0
    renderProgress.elapsedMs = 0
    renderProgress.estimatedTotalMs = 0
    renderProgress.renderFps = 0
    renderProgress.finished = false
    isRendering.value = true

    try {
      await renderConcurrent(video, sourceCanvas, targetFpsValue, thresholdValue, invertValue)
    } catch (error) {
      console.error('Render failed:', error)
      isRendering.value = false
    }
  }

  return {
    isRendering,
    renderProgress,
    packedFrames,
    handleRender,
    cleanupWorker,
  }
}
