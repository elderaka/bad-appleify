<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
    src: string
    muted: boolean
    paused: boolean
    smoothInterpolation?: boolean
}>()

const emit = defineEmits<{
    'update:currentTime': [value: number]
    'update:duration': [value: number]
    'loaded-metadata': [video: HTMLVideoElement]
    'timeupdate': [time: number]
    'progress': [percentage: number]
    'canplaythrough': []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

const tryPlay = async () => {
    const video = videoRef.value
    if (video) {
        try {
            await video.play()
        } catch (err) {
            console.warn('[VideoBackground] Autoplay blocked', err)
        }
    }
}

onMounted(() => {
    tryPlay()
})

watch(() => props.paused, (isPaused) => {
    const video = videoRef.value
    if (!video) return
    if (isPaused) {
        video.pause()
    } else {
        tryPlay()
    }
})

watch(() => props.muted, (isMuted) => {
    const video = videoRef.value
    if (video) {
        video.muted = isMuted
    }
})

const handleLoadedMetadata = () => {
    if (videoRef.value) {
        emit('update:duration', videoRef.value.duration)
        emit('loaded-metadata', videoRef.value)
    }
}

const handleTimeUpdate = () => {
    if (videoRef.value) {
        emit('update:currentTime', videoRef.value.currentTime)
        emit('timeupdate', videoRef.value.currentTime)
    }
}

const handleProgress = () => {
    const video = videoRef.value
    if (video && video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        const progress = Math.min(100, (bufferedEnd / video.duration) * 100)
        emit('progress', progress)
    }
}

const handleCanPlayThrough = () => {
    emit('canplaythrough')
}

const handleEnded = () => {
    if (videoRef.value) {
        videoRef.value.currentTime = 0
        videoRef.value.play()
    }
}

defineExpose({
    videoRef,
})
</script>

<template>
    <video ref="videoRef" class="video-background" :class="{ smooth: smoothInterpolation }" 
      :src="src" :muted="muted" playsinline loop autoplay
    @loadedmetadata="handleLoadedMetadata" @timeupdate="handleTimeUpdate" 
    @progress="handleProgress" @canplaythrough="handleCanPlayThrough" 
    @waiting="handleProgress" @stalled="handleProgress" @ended="handleEnded" />
</template>

<style scoped>
.video-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    object-fit: cover;
    z-index: -1;
    pointer-events: none;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}

.video-background.smooth {
    image-rendering: auto;
}
</style>
