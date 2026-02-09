<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
    currentTime: number
    duration: number
}>()

const emit = defineEmits<{
    'seek': [time: number]
}>()

const progressRef = ref<HTMLDivElement | null>(null)

const progress = computed(() => {
    if (props.duration === 0) return 0
    return (props.currentTime / props.duration) * 100
})

const handleClick = (event: MouseEvent) => {
    if (!progressRef.value) return
    const rect = progressRef.value.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    const time = percent * props.duration
    emit('seek', Math.max(0, Math.min(time, props.duration)))
}
</script>

<template>
    <div ref="progressRef" class="video-progress" @click="handleClick">
        <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
    </div>
</template>

<style scoped>
.video-progress {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 5vh;
    z-index: 100;
    cursor: pointer;
    display: flex;
    align-items: flex-end;
    mix-blend-mode: difference;
    padding: calc(5vh - 4px) 0 0 0;
    transition: padding 0.3s ease;
}

.video-progress:hover {
    padding: 0;
}

.progress-bar {
    width: 100%;
    height: 100%;
    background: #fff;
    transition: width 0.1s linear;
}
</style>
