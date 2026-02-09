<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    current: number
    total: number
    label?: string
}>()

const progress = computed(() => {
    if (props.total === 0) return 0
    return Math.min(100, (props.current / props.total) * 100)
})
</script>

<template>
    <div class="loading-bar-container">
        <div class="loading-bar" :style="{ width: `${progress}%` }"></div>
        <div class="loading-text">{{ label || 'LOADING...' }} {{ Math.floor(progress) }}%</div>
    </div>
</template>

<style scoped>
.loading-bar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    z-index: 1000;
    mix-blend-mode: difference;
    pointer-events: none;
}

.loading-bar {
    height: 100%;
    background: #fff;
    transition: width 0.1s linear;
}

.loading-text {
    position: absolute;
    top: 10px;
    right: 20px;
    color: #fff;
    font-family: 'Press Start 2P', cursive;
    font-size: clamp(8px, 1.5vw, 12px);
    letter-spacing: 1px;
}
</style>
