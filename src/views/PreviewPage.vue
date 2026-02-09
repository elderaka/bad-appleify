<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getPixelFromBuffer } from '../utils/upload'
import { previewStore, clearPreviewData } from '../store'

const router = useRouter()

const videoRef = ref<HTMLVideoElement | null>(null)
const currentFrame = ref(0)
const isPlaying = ref(false)
const uploadedData = ref<{
  data: Uint8Array
  frameCount: number
  width: number
  height: number
  fps: number
} | null>(null)

let playbackInterval: number | null = null

onMounted(() => {
  const data = previewStore.value
  if (data) {
    uploadedData.value = data
    
    if (videoRef.value) {
      videoRef.value.play()
    }
  } else {
    router.push('/')
  }
})

const handleVideoPlay = () => {
  if (!uploadedData.value) return
  
  isPlaying.value = true
  const fps = uploadedData.value.fps
  
  playbackInterval = window.setInterval(() => {
    if (!videoRef.value) return
    
    const videoTime = videoRef.value.currentTime
    const targetFrame = Math.floor(videoTime * fps)
    
    if (targetFrame < uploadedData.value!.frameCount) {
      currentFrame.value = targetFrame
    }
  }, 1000 / fps)
}

const handleVideoPause = () => {
  isPlaying.value = false
  if (playbackInterval !== null) {
    clearInterval(playbackInterval)
    playbackInterval = null
  }
}

const handleVideoSeek = () => {
  if (!videoRef.value || !uploadedData.value) return
  
  const videoTime = videoRef.value.currentTime
  const targetFrame = Math.floor(videoTime * uploadedData.value.fps)
  
  if (targetFrame < uploadedData.value.frameCount) {
    currentFrame.value = targetFrame
  }
}

const togglePlay = () => {
  if (!videoRef.value) return
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    videoRef.value.play()
  }
}

const handleBack = () => {
  clearPreviewData()
  router.push('/')
}

onBeforeUnmount(() => {
  if (playbackInterval !== null) {
    clearInterval(playbackInterval)
  }
})
</script>

<template>
  <div v-if="uploadedData" class="preview-page">
    <div class="header">
      <button @click="handleBack" class="back-btn">← Back</button>
      <h1>Preview using &lt;table&gt;</h1>
      <button @click="togglePlay" class="header-play-btn" :title="isPlaying ? 'Pause' : 'Play'">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <div class="info">
        {{ uploadedData.width }}×{{ uploadedData.height }} @ {{ uploadedData.fps }} fps
        <span class="frame-counter">Frame {{ currentFrame + 1 }}/{{ uploadedData.frameCount }}</span>
      </div>
    </div>

    <div class="content">
      <div class="table-wrapper">
        <table class="pixel-grid">
          <tr v-for="y in uploadedData.height" :key="y">
            <td 
              v-for="x in uploadedData.width" 
              :key="x"
              :class="{ on: getPixelFromBuffer(uploadedData.data, currentFrame, x - 1, y - 1, uploadedData.width, uploadedData.height) }"
            ></td>
          </tr>
        </table>
      </div>
    </div>

    <video 
      ref="videoRef" 
      src="/bad_apple.mp4" 
      class="hidden-video"
      @play="handleVideoPlay"
      @pause="handleVideoPause"
      @seeked="handleVideoSeek"
      loop
    ></video>

    <div class="controls">
      <button @click="videoRef?.paused ? videoRef?.play() : videoRef?.pause()" class="control-btn">
        {{ videoRef?.paused ? '▶ Play' : '⏸ Pause' }}
      </button>
    </div>
  </div>
  <div v-else class="loading">
    <p>Loading preview...</p>
  </div>
</template>

<style scoped>
.preview-page {
  min-height: 100vh;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 20px;
  background: rgba(0, 0, 0, 0.8);
  border-bottom: 2px solid #333;
  display: flex;
  align-items: center;
  gap: 20px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.back-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.header-play-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 10px;
  font-size: 14px;
  transition: all 0.2s;
}

.header-play-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
  border-color: #fff;
}

.info {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 14px;
  color: #aaa;
}

.frame-counter {
  font-size: 12px;
  color: #666;
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
}

.table-wrapper {
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #333;
  border-radius: 8px;
  padding: 16px;
}

.pixel-grid {
  border-collapse: collapse;
  margin: 0 auto;
}

.pixel-grid td {
  width: 8px;
  height: 8px;
  background: #000;
  border: 1px solid #222;
}

.pixel-grid td.on {
  background: #fff;
}

.hidden-video {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 200px;
  height: auto;
  border: 2px solid #333;
  border-radius: 8px;
  z-index: 99;
}

.controls {
  padding: 20px;
  background: rgba(0, 0, 0, 0.8);
  border-top: 2px solid #333;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.control-btn {
  padding: 12px 24px;
  background: #fff;
  border: none;
  border-radius: 6px;
  color: #000;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.3);
}

.loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #fff;
  font-size: 18px;
}
</style>
