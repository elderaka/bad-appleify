<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { parseFilename, detectPossibleResolutions, loadBinaryFile, getPixel, type UploadedBinaryMeta, type ResolutionCandidate } from '../utils/upload'
import { setPreviewData } from '../store'

const router = useRouter()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'close': []
  'playing': [isPlaying: boolean]
}>()

const uploadedFile = ref<File | null>(null)
const uploadedData = ref<Uint8Array | null>(null)
const detectedWidth = ref(640)
const detectedHeight = ref(480)
const detectedFps = ref(30)
const previewFrameData = ref<Uint8Array | null>(null)
const resolutionCandidates = ref<ResolutionCandidate[]>([])
const showCandidates = ref(false)
// const allFrames = ref<Uint8Array[]>([]) // Removed: too heavy
const isPlaying = ref(false)
const currentFrame = ref(0)
const showInstructions = ref(true)
let playbackInterval: number | null = null

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadedFile.value = file
  
  const metadata = parseFilename(file.name)
  if (metadata) {
    detectedWidth.value = metadata.width
    detectedHeight.value = metadata.height
    detectedFps.value = metadata.fps
    showCandidates.value = false
  } else {
    const data = await loadBinaryFile(file)
    uploadedData.value = data
    const candidates = detectPossibleResolutions(data.length)
    resolutionCandidates.value = candidates
    if (candidates.length > 0) {
      detectedWidth.value = candidates[0]!.width
      detectedHeight.value = candidates[0]!.height
    }
    showCandidates.value = candidates.length > 1
  }

  await loadPreview()
}

const previewCanvasRef = ref<HTMLCanvasElement | null>(null)

const drawPreviewFrame = () => {
  const canvas = previewCanvasRef.value
  const data = previewFrameData.value
  if (!canvas || !data) return
  
  const width = detectedWidth.value
  const height = detectedHeight.value
  
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const imageData = ctx.createImageData(width, height)
  const pixelData = imageData.data
  
  // Draw the currently selected frame (currentFrame)
  // We need to pass the full uploadedData if available, or just use the previewFrameData chunk 
  // identifying that previewFrameData is just ONE frame.
  
  // Actually, previewFrameData IS just one frame slice.
  // So we iterate over it.
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // getPixel helper expects a frame buffer (Uint8Array)
      const pixel = getPixel(data, x, y, width)
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

const loadPreview = async () => {
  if (!uploadedFile.value) return
  
  try {
    const data = uploadedData.value || await loadBinaryFile(uploadedFile.value)
    uploadedData.value = data
    
    // Validate we have enough data for at least one frame
    const bytesPerFrame = Math.ceil(detectedWidth.value / 8) * detectedHeight.value
    if (data.length >= bytesPerFrame) {
      // Calculate total frames
      const totalFrames = Math.floor(data.length / bytesPerFrame)
      
      // Pick a random frame for preview because frame 0 is often black/blank
      const randomFrameIndex = Math.floor(Math.random() * totalFrames)
      
      const start = randomFrameIndex * bytesPerFrame
      previewFrameData.value = data.slice(start, start + bytesPerFrame)
      currentFrame.value = randomFrameIndex
      
      // Draw next tick to ensure canvas is ready
      setTimeout(() => drawPreviewFrame(), 0)
    }
  } catch (error) {
    console.error('Failed to load preview:', error)
  }
}

const handlePlayPause = () => {
  togglePreviewPlayback()
}

const navigateToPreview = () => {
  if (!uploadedData.value) return
  
  // Store data in global store to avoid storage limits
  const bytesPerFrame = Math.ceil(detectedWidth.value / 8) * detectedHeight.value
  const frameCount = Math.floor(uploadedData.value.length / bytesPerFrame)

  setPreviewData({
    data: uploadedData.value, // Flat buffer
    frameCount,
    width: detectedWidth.value,
    height: detectedHeight.value,
    fps: detectedFps.value,
  })
  router.push('/preview')
  handleClose()
}

const togglePreviewPlayback = () => {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    // Start local preview loop
    if (!uploadedData.value) return
    
    isPlaying.value = true
    // emit('playing', true) // Only emit if we want parent to know, but parent closes modal on 'playing'? No.
    
    const fps = detectedFps.value
    const interval = 1000 / fps
    let lastTime = performance.now()
    
    const animate = (time: number) => {
      if (!isPlaying.value) return
      
      const delta = time - lastTime
      
      if (delta >= interval) {
        lastTime = time - (delta % interval)
        
        const bytesPerFrame = Math.ceil(detectedWidth.value / 8) * detectedHeight.value
        const totalFrames = Math.floor(uploadedData.value!.length / bytesPerFrame)
        
        let nextFrame = currentFrame.value + 1
        if (nextFrame >= totalFrames) {
          nextFrame = 0
        }
        currentFrame.value = nextFrame
        
        const start = nextFrame * bytesPerFrame
        previewFrameData.value = uploadedData.value!.slice(start, start + bytesPerFrame)
        drawPreviewFrame()
      }
      
      playbackInterval = requestAnimationFrame(animate)
    }
    
    playbackInterval = requestAnimationFrame(animate)
  }
}



const stopPlayback = () => {
  if (playbackInterval !== null) {
    cancelAnimationFrame(playbackInterval)
    playbackInterval = null
  }
  isPlaying.value = false
  emit('playing', false)
}

const handleClose = () => {
  stopPlayback()
  uploadedFile.value = null
  uploadedData.value = null
  previewFrameData.value = null
  // allFrames.value = [] // Removed
  resolutionCandidates.value = []
  showCandidates.value = false
  showInstructions.value = true
  currentFrame.value = 0
  emit('close')
}

const handleDownloadDecoder = async () => {
  const { downloadDecoder } = await import('../utils/downloads')
  downloadDecoder('binary-decoder.js')
}

const handleGetInjector = async () => {
  try {
    const res = await fetch('/injector.js')
    if (!res.ok) throw new Error('Script not found')
    const text = await res.text()
    await navigator.clipboard.writeText(text)
    // Simple notification since we don't have a toast component ready
    // Using native alert for reliability in this specific context
    alert('Injector script copied to clipboard!\n\nInstructions:\n1. Open your target website\n2. Open Console (F12)\n3. Paste the script and run it\n4. Upload your .bin.gz file when prompted')
  } catch (e) {
    console.error('Failed to copy injector script:', e)
    alert('Failed to fetch/copy script. Please try manually downloading /injector.js')
  }
}

const previewSize = computed(() => {
  // When playing, show full resolution; when static, limit to 48 for performance
  return isPlaying.value 
    ? { width: detectedWidth.value, height: detectedHeight.value }
    : { width: Math.min(detectedWidth.value, 48), height: Math.min(detectedHeight.value, 48) }
})

watch(() => props.show, (newVal) => {
  if (!newVal) {
    stopPlayback()
  }
})

onBeforeUnmount(() => {
  stopPlayback()
})
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Upload Binary Preview</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <div class="upload-section">
          <input type="file" accept=".bin,.bin.gz" @change="handleFileSelect" class="file-input" id="file-upload" />
          <label for="file-upload" class="file-label">
            {{ uploadedFile ? uploadedFile.name : 'Choose File (bad-apple-WIDTHxHEIGHT@FPS.bin.gz)' }}
          </label>
          <small style="color: white;"> IMPORTANT!!! Filename should be: bad-apple-WIDTHxHEIGHT@FPS.bin.gz or it wouldn't work</small>
        </div>

        <div v-if="uploadedFile && !isPlaying" class="config-section">
          <div class="input-group">
            <label>Resolution:</label>
            <div class="resolution-inputs">
              <input type="number" v-model.number="detectedWidth" @input="loadPreview" min="16" max="1920" />
              <span>×</span>
              <input type="number" v-model.number="detectedHeight" @input="loadPreview" min="16" max="1080" />
            </div>
          </div>

          <div v-if="showCandidates && resolutionCandidates.length > 0" class="candidates">
            <small>Detected possibilities:</small>
            <div class="candidate-list">
              <button 
                v-for="(candidate, i) in resolutionCandidates.slice(0, 5)" 
                :key="i"
                @click="detectedWidth = candidate.width; detectedHeight = candidate.height; loadPreview()"
                class="candidate-btn"
              >
                {{ candidate.width }}×{{ candidate.height }} ({{ candidate.aspectRatio }})
              </button>
            </div>
          </div>

          <div class="input-group">
            <label>FPS:</label>
            <input type="number" v-model.number="detectedFps" min="1" max="60" />
          </div>
        </div>

        <div v-if="previewFrameData" class="preview-section" :class="{ playing: isPlaying }">
          <div class="preview-header">
            <label>{{ isPlaying ? `Playing` : 'Preview' }} (Frame {{ currentFrame + 1 }}/?)</label>
            <button @click="handlePlayPause" class="play-btn">
              {{ isPlaying ? '⏸ Pause' : '▶ Play' }}
            </button>
          </div>
          <div class="canvas-container">
            <canvas ref="previewCanvasRef"></canvas>
          </div>
          <small v-if="!isPlaying" class="preview-note">
            Showing {{ detectedWidth }}×{{ detectedHeight }} (Random Frame)
          </small>
        </div>

        <div class="actions">
          <button @click="handleDownloadDecoder" class="secondary-btn">Download Decoder.js</button>
          <button @click="handleGetInjector" class="secondary-btn">Get Table Injector</button>
          <button @click="navigateToPreview" class="primary-btn">Try the Bad Appleify</button>
        </div>

        <transition name="slide-up">
          <div v-if="showInstructions" class="instructions">
            <h3>How to Use Binary Format</h3>
            <p><strong>Format:</strong> 1-bit pixels (black/white), row-major, MSB-first, gzip compressed</p>
            <p><strong>Filename Convention:</strong> <code>bad-apple-WIDTHxHEIGHT@FPS.bin.gz</code></p>
            <p><strong>Example Usage:</strong></p>
            <pre><code>const animation = await loadBadAppleBinary('file.bin.gz', 640, 480);
const canvas = document.getElementById('canvas');
let frame = 0;
setInterval(() => {
  // Pass the entire data buffer and the current frame index
  renderFrame(animation.data, frame, canvas, 640, 480);
  frame = (frame + 1) % animation.frameCount;
}, 1000 / 30);</code></pre>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.slide-up-enter-from,
.slide-up-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #fff;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 32px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-input {
  display: none;
}

.file-label {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.file-label:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.input-group label {
  font-size: 12px;
  color: #aaa;
  min-width: 80px;
  font-weight: 600;
}

.input-group input[type="number"] {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
}

.input-group input[type="number"]:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.15);
}

.resolution-inputs {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.resolution-inputs span {
  color: #666;
}

.candidates {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.candidates small {
  font-size: 10px;
  color: #888;
}

.candidate-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.candidate-btn {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.candidate-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s ease;
}

.preview-section.playing .table-container {
  max-height: 60vh;
}

.play-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  width: 100%; /* Wide button */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
}

.play-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.canvas-container {
  overflow: auto;
  max-height: 400px;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 0;
  display: flex;
  justify-content: center;
  background-image: linear-gradient(45deg, #111 25%, transparent 25%), 
                    linear-gradient(-45deg, #111 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #111 75%), 
                    linear-gradient(-45deg, transparent 75%, #111 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.canvas-container canvas {
  max-width: 100%;
  height: auto;
  display: block;
}

.preview-note {
  font-size: 10px;
  color: #666;
  text-align: center;
}

.actions {
  display: flex;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.secondary-btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.primary-btn {
  flex: 2;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  border: none;
  color: #000;
}

.primary-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.instructions {
  background: rgba(255, 255, 255, 0.03);
  padding: 16px;
  border-radius: 6px;
  font-size: 12px;
  color: #aaa;
}

.instructions h3 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #fff;
  font-weight: 600;
}

.instructions p {
  margin: 8px 0;
  line-height: 1.5;
}

.instructions code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #0f0;
}

.instructions pre {
  margin: 12px 0 0 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow-x: auto;
}

.instructions pre code {
  background: none;
  padding: 0;
  display: block;
  line-height: 1.6;
  color: #ccc;
}
</style>
