<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue'
import VideoBackground from '../components/VideoBackground.vue'
import VideoControls from '../components/VideoControls.vue'
import VideoProgress from '../components/VideoProgress.vue'
import StencilTitle from '../components/StencilTitle.vue'
import ConfigPanel from '../components/ConfigPanel.vue'
import DraggablePreview from '../components/DraggablePreview.vue'
import UploadPreviewModal from '../components/UploadPreviewModal.vue'
import LoadingBar from '../components/LoadingBar.vue'
import { useFrameRenderer } from '../composables/useFrameRenderer'
import { usePlayback } from '../composables/usePlayback'
import { clampSize } from '../utils/formatters'
import { drawBinarizedPreview } from '../utils/imageProcessing'
import { downloadBinaryGzip, downloadDecoder } from '../utils/downloads'
import type { RenderMeta } from '../types'
import type { UploadedBinaryMeta } from '../utils/upload'

const videoMuted = ref(true)
const videoPaused = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const threshold = ref(128)
const invert = ref(false)
const pixelated = ref(true)
const smoothInterpolation = ref(false)
const targetMaxSize = ref(480)
const targetFps = ref(30)
const isRendering = ref(false)
const isResourceLoading = ref(true)
const resourceLoadingProgress = ref(0)

const showUploadModal = ref(false)
const isBinaryPreviewPlaying = ref(false)

const videoBackgroundRef = ref<InstanceType<typeof VideoBackground> | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const sourceCanvasRef = ref<HTMLCanvasElement | null>(null)
const smallPreviewCanvasRef = ref<HTMLCanvasElement | null>(null)
const fullRenderedCanvasRef = ref<HTMLCanvasElement | null>(null)
const portalCanvasRef = ref<HTMLCanvasElement | null>(null)
const playbackCanvasRef = ref<HTMLCanvasElement | null>(null)
const draggablePreviewRef = ref<InstanceType<typeof DraggablePreview> | null>(null)

const renderMeta = reactive<RenderMeta>({
  width: 0,
  height: 0,
  duration: 0,
  frames: 0,
  fps: 0,
  bytesPerFrame: 0,
})

const previewSize = ref(300)

const updatePreviewSize = () => {
  previewSize.value = Math.min(window.innerWidth * 0.4, window.innerHeight * 0.4, 300)
}

const handleResize = () => {
  updatePreviewSize()
  
  // Clamp draggable window position to new viewport bounds
  if (draggablePreviewRef.value?.position) {
    const pos = draggablePreviewRef.value.position
    const size = previewSize.value
    draggablePreviewRef.value.position = {
      x: Math.max(0, Math.min(pos.x, window.innerWidth - size)),
      y: Math.max(0, Math.min(pos.y, window.innerHeight - size)),
    }
  }
  
  // Reinitialize canvases to match new viewport size
  if (videoRef.value) {
    initCanvases()
  }
}

onMounted(() => {
  updatePreviewSize()
  window.addEventListener('resize', handleResize)
  
  // Interaction fallback for autoplay
  const handleInteraction = () => {
    if (videoRef.value && videoRef.value.paused) {
      videoRef.value.play().catch(() => {})
    }
    window.removeEventListener('click', handleInteraction)
    window.removeEventListener('touchstart', handleInteraction)
  }
  window.addEventListener('click', handleInteraction)
  window.addEventListener('touchstart', handleInteraction)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const handleVideoLoaded = (video: HTMLVideoElement) => {
  videoRef.value = video
  initCanvases()
}

const handleCanPlayThrough = () => {
  isResourceLoading.value = false
}

const handleSeek = (time: number) => {
  if (videoRef.value) {
    videoRef.value.currentTime = time
  }
}


const applyTargetResolution = () => {
  const video = videoRef.value
  const sourceCanvas = sourceCanvasRef.value
  const previewCanvas = smallPreviewCanvasRef.value
  if (!video || !sourceCanvas || !previewCanvas) return
  if (video.videoWidth === 0 || video.videoHeight === 0) return

  const maxSize = clampSize(targetMaxSize.value, 16, 512)
  targetMaxSize.value = maxSize

  const aspect = video.videoWidth / video.videoHeight
  let targetWidth = maxSize
  let targetHeight = Math.max(1, Math.round(maxSize / aspect))
  if (targetHeight > maxSize) {
    targetHeight = maxSize
    targetWidth = Math.max(1, Math.round(maxSize * aspect))
  }

  renderMeta.width = targetWidth
  renderMeta.height = targetHeight
  renderMeta.duration = video.duration
  renderMeta.bytesPerFrame = Math.ceil(targetWidth / 8) * targetHeight

  sourceCanvas.width = targetWidth
  sourceCanvas.height = targetHeight
  previewCanvas.width = targetWidth
  previewCanvas.height = targetHeight
}

const drawPreview = () => {
  const video = videoRef.value
  const sourceCanvas = sourceCanvasRef.value
  const smallCanvas = smallPreviewCanvasRef.value
  const fullCanvas = fullRenderedCanvasRef.value
  const portalCanvas = portalCanvasRef.value
  if (!video || !sourceCanvas || !smallCanvas || !fullCanvas) return

  drawBinarizedPreview(video, sourceCanvas, smallCanvas, threshold.value, invert.value)

  const fullW = fullCanvas.width
  const fullH = fullCanvas.height
  const smallW = smallCanvas.width
  const smallH = smallCanvas.height
  const fullCtx = fullCanvas.getContext('2d')
  if (!fullCtx) return
  fullCtx.clearRect(0, 0, fullW, fullH)
  fullCtx.imageSmoothingEnabled = false
  const scale = Math.max(fullW / smallW, fullH / smallH)
  const dw = Math.round(smallW * scale)
  const dh = Math.round(smallH * scale)
  const dx = Math.round((fullW - dw) / 2)
  const dy = Math.round((fullH - dh) / 2)
  fullCtx.drawImage(smallCanvas, 0, 0, smallW, smallH, dx, dy, dw, dh)

  if (portalCanvas && draggablePreviewRef.value && draggablePreviewRef.value.position) {
    const pos = draggablePreviewRef.value.position
    const portalW = portalCanvas.width
    const portalH = portalCanvas.height
    const isFullscreenMode = draggablePreviewRef.value.isFullscreen

    const sx = isFullscreenMode ? 0 : Math.round(pos.x)
    const sy = isFullscreenMode ? 0 : Math.round(pos.y)

    const portalCtx = portalCanvas.getContext('2d')
    if (!portalCtx) return
    portalCtx.clearRect(0, 0, portalW, portalH)
    portalCtx.imageSmoothingEnabled = false
    
    const readW = Math.max(0, Math.min(portalW, fullW - sx))
    const readH = Math.max(0, Math.min(portalH, fullH - sy))
    
    if (readW > 0 && readH > 0) {
      portalCtx.drawImage(fullCanvas, sx, sy, readW, readH, 0, 0, portalW, portalH)
    }
  }
}

const initCanvases = () => {
  applyTargetResolution()

  const smallCanvas = smallPreviewCanvasRef.value
  const fullCanvas = fullRenderedCanvasRef.value
  const sourceCanvas = sourceCanvasRef.value
  const portalCanvas = portalCanvasRef.value
  if (!smallCanvas || !fullCanvas || !sourceCanvas) return

  smallCanvas.width = renderMeta.width
  smallCanvas.height = renderMeta.height

  fullCanvas.width = Math.max(1, Math.floor(window.innerWidth))
  fullCanvas.height = Math.max(1, Math.floor(window.innerHeight))

  if (portalCanvas) {
    const isFullscreenMode = draggablePreviewRef.value?.isFullscreen
    const windowSizeValue = draggablePreviewRef.value?.windowSize || previewSize.value
    
    if (isFullscreenMode) {
      portalCanvas.width = Math.max(1, Math.floor(window.innerWidth))
      portalCanvas.height = Math.max(1, Math.floor(window.innerHeight))
    } else {
      const px = Math.max(1, Math.floor(windowSizeValue))
      portalCanvas.width = px
      portalCanvas.height = px
    }
  }

  drawPreview()
}

watch([threshold, invert], () => {
  if (!isRendering.value) {
    drawPreview()
  }
})

watch(targetMaxSize, () => {
  if (!isRendering.value) {
    applyTargetResolution()
    drawPreview()
  }
})

watch(
  () => draggablePreviewRef.value?.position,
  () => {
    if (!isRendering.value) {
      drawPreview()
    }
  },
  { deep: true }
)

watch(
  () => [draggablePreviewRef.value?.windowSize, draggablePreviewRef.value?.isFullscreen],
  ([newSize, newFullscreen]) => {
    const portalCanvas = portalCanvasRef.value
    if (!portalCanvas) return
    
    if (newFullscreen) {
      portalCanvas.width = window.innerWidth
      portalCanvas.height = window.innerHeight
    } else if (newSize) {
      portalCanvas.width = newSize as number
      portalCanvas.height = newSize as number
    }
    
    if (!isRendering.value) {
      drawPreview()
    }
  },
  { deep: true }
)

const { renderProgress, packedFrames, handleRender, cleanupWorker } = useFrameRenderer(
  videoRef,
  sourceCanvasRef,
  renderMeta,
  threshold,
  invert,
  targetFps,
)

// Dynamic Title Handling
watch([isRendering, isResourceLoading, () => renderProgress.current, () => renderProgress.total, resourceLoadingProgress], 
  ([rendering, resourceLoading, current, total, resProgress]) => {
  if (rendering) {
    const percent = total > 0 ? Math.floor((current / total) * 100) : 0
    document.title = `An apple a day keeps the doctor await ${percent}%`
  } else if (resourceLoading) {
    document.title = `An apple a day keeps the doctor await ${Math.floor(resProgress)}%`
  } else {
    document.title = 'Bad Appleify'
  }
})

const {
  initializePlayback,
  startPlayback,
  stopPlayback,
} = usePlayback(packedFrames, renderMeta, playbackCanvasRef, videoRef, drawPreview)

let previewAnimationId: number | null = null
let lastPreviewTime = 0

const startPreviewLoop = () => {
  if (previewAnimationId !== null) return

  const updatePreview = () => {
    const now = performance.now()
    const previewInterval = 1000 / targetFps.value

    if (now - lastPreviewTime >= previewInterval) {
      drawPreview()
      lastPreviewTime = now
    }

    previewAnimationId = requestAnimationFrame(updatePreview)
  }

  previewAnimationId = requestAnimationFrame(updatePreview)
}

const stopPreviewLoop = () => {
  if (previewAnimationId !== null) {
    cancelAnimationFrame(previewAnimationId)
    previewAnimationId = null
  }
}

const hasRender = computed(() => packedFrames.value.length > 0)

const onRender = async () => {
  isRendering.value = true
  startPreviewLoop()
  await handleRender()
  isRendering.value = false

  if (packedFrames.value.length > 0) {
    await initializePlayback(playbackCanvasRef.value)
  }
}

watch(videoPaused, (paused) => {
  if (paused) {
    stopPreviewLoop()
  } else {
    startPreviewLoop()
    if (!isRendering.value && packedFrames.value.length > 0) {
      startPlayback()
    }
  }
})

const handleTimeUpdate = () => {
  if (!isRendering.value && !videoPaused.value) {
    drawPreview()
  }
}

const handleDownloadBinaryGzip = () => {
  downloadBinaryGzip(packedFrames.value, renderMeta)
}

const handleDownloadDecoder = (filename: string) => {
  downloadDecoder(filename)
}

const handleUploadComplete = async (data: UploadedBinaryMeta) => {
  packedFrames.value = data.frames
  renderMeta.width = data.width
  renderMeta.height = data.height
  renderMeta.frames = data.frameCount
  renderMeta.fps = data.fps
  renderMeta.duration = data.frameCount / data.fps
  renderMeta.bytesPerFrame = Math.ceil(data.width / 8) * data.height
  
  targetMaxSize.value = Math.max(data.width, data.height)
  targetFps.value = data.fps
  
  if (videoRef.value) {
    videoRef.value.currentTime = 0
    videoRef.value.play()
  }
  
  await initializePlayback(playbackCanvasRef.value)
  startPlayback()
}

onMounted(() => {
  startPreviewLoop()
})

onBeforeUnmount(() => {
  stopPreviewLoop()
  stopPlayback()
  cleanupWorker()
})
</script>

<template>
  <div class="app">
    <VideoBackground ref="videoBackgroundRef" src="/bad_apple.mp4" :muted="videoMuted" :paused="videoPaused"
      :smooth-interpolation="smoothInterpolation"
      @update:current-time="currentTime = $event" @update:duration="duration = $event"
      @loaded-metadata="handleVideoLoaded" @timeupdate="handleTimeUpdate" 
      @progress="resourceLoadingProgress = $event" @canplaythrough="handleCanPlayThrough" />

    <LoadingBar v-if="isResourceLoading" :current="resourceLoadingProgress" :total="100" label="LOADING ASSETS..." />
    <LoadingBar v-else-if="isRendering" :current="renderProgress.current" :total="renderProgress.total" label="PACKING FRAMES..." />

    <VideoControls v-model:muted="videoMuted" v-model:paused="videoPaused" @upload="showUploadModal = true" />

    <!-- Config Panel (left sidebar, collapsible) -->
    <ConfigPanel v-model:threshold="threshold" v-model:invert="invert"
      v-model:target-max-size="targetMaxSize" v-model:target-fps="targetFps" :render-meta="renderMeta"
      :is-rendering="isRendering" :render-progress="renderProgress" :has-render="hasRender" @render="onRender"
      @download-binary-gzip="handleDownloadBinaryGzip" @download-decoder="handleDownloadDecoder" />

    <DraggablePreview v-if="!isBinaryPreviewPlaying" ref="draggablePreviewRef" :size="previewSize" :pixelated="pixelated">
      <canvas ref="portalCanvasRef" class="portal-canvas" :class="{ pixelated }"></canvas>
    </DraggablePreview>

    <StencilTitle text="Bad Appleify" />

    <VideoProgress :current-time="currentTime" :duration="duration" @seek="handleSeek" />

    <canvas ref="sourceCanvasRef" class="hidden"></canvas>
    <canvas ref="smallPreviewCanvasRef" class="hidden"></canvas>
    <canvas ref="fullRenderedCanvasRef" class="hidden"></canvas>
    <canvas v-if="hasRender" ref="playbackCanvasRef" class="hidden"></canvas>

    <UploadPreviewModal :show="showUploadModal" @close="showUploadModal = false" @playing="isBinaryPreviewPlaying = $event" />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #000;
  font-family: system-ui, -apple-system, sans-serif;
}
</style>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* Layer 2: Rendered canvas is hidden, only visible through portal window */

/* Canvas shown in the draggable portal window */
.portal-canvas {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

/* Pixelated rendering - applied when pixelated is true */
.portal-canvas.pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* Smooth rendering - default or when smooth interpolation enabled */
.portal-canvas:not(.pixelated) {
  image-rendering: auto;
}

.hidden {
  display: none;
}
</style>
