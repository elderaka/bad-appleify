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
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

onMounted(() => {
    const video = videoRef.value
    if (video) {
        video.play().catch(() => {
            // Autoplay blocked, user must interact
        })
    }
})

watch(() => props.paused, (isPaused) => {
    const video = videoRef.value
    if (!video) return
    if (isPaused) {
        video.pause()
    } else {
        video.play()
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
      :src="src" :muted="muted" playsinline loop
      @loadedmetadata="handleLoadedMetadata" @timeupdate="handleTimeUpdate" @ended="handleEnded" />
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
