<script setup lang="ts">
defineProps<{
    muted: boolean
    paused: boolean
}>()

const emit = defineEmits<{
    'update:muted': [value: boolean]
    'update:paused': [value: boolean]
    'upload': []
}>()
</script>

<template>
    <div class="video-controls">
        <button class="control-btn" @click="emit('update:paused', !paused)" :title="paused ? 'Play' : 'Pause'">
            <span v-if="paused">▶</span>
            <span v-else>❚❚</span>
        </button>
        <button class="control-btn" @click="emit('update:muted', !muted)" :title="muted ? 'Unmute' : 'Mute'">
            <svg v-if="muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
        </button>
        <button class="control-btn" @click="emit('upload')" title="Upload .bin.gz">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
        </button>
    </div>
</template>

<style scoped>
.video-controls {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 100;
    display: flex;
    gap: 8px;
}

.control-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
}

.control-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.5);
    transform: scale(1.05);
}
</style>
