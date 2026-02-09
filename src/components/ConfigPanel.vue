```
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RenderMeta, RenderProgress } from '../types'

const props = defineProps<{
    threshold: number
    invert: boolean
    targetMaxSize: number
    targetFps: number
    renderMeta: RenderMeta
    isRendering: boolean
    renderProgress: RenderProgress
    hasRender: boolean
}>()

const emit = defineEmits<{
    'update:threshold': [value: number]
    'update:invert': [value: boolean]
    'update:targetMaxSize': [value: number]
    'update:targetFps': [value: number]
    'render': []
    'download-binary-gzip': []
    'download-decoder': [filename: string]
}>()

const isCollapsed = ref(true)
const editableHeight = ref(props.renderMeta.height || 360)
const renderStartTime = ref(0)
const elapsedSeconds = ref(0)
let timerInterval: number | null = null

watch(() => props.renderMeta.height, (newHeight) => {
    if (newHeight) editableHeight.value = newHeight
})

watch(() => props.isRendering, (rendering) => {
    if (rendering) {
        renderStartTime.value = Date.now()
        elapsedSeconds.value = 0
        timerInterval = window.setInterval(() => {
            elapsedSeconds.value = Math.floor((Date.now() - renderStartTime.value) / 1000)
        }, 1000)
    } else if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
})

const handleHeightInput = (event: Event) => {
    const target = event.target as HTMLInputElement
    const newHeight = Number(target.value)
    if (newHeight >= 16 && newHeight <= 360 && props.renderMeta.width && props.renderMeta.height) {
        const aspect = props.renderMeta.width / props.renderMeta.height
        const newMaxSize = Math.max(newHeight, Math.round(newHeight * aspect))
        emit('update:targetMaxSize', newMaxSize)
    }
}

const estimatedFrames = computed(() =>
    Math.floor(props.renderMeta.duration * props.targetFps) || 0
)

const progressPercent = computed(() => {
    if (props.renderProgress.total === 0) return 0
    return Math.round((props.renderProgress.current / props.renderProgress.total) * 100)
})

const formattedElapsedTime = computed(() => {
    const mins = Math.floor(elapsedSeconds.value / 60)
    const secs = elapsedSeconds.value % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
})

const estimatedRemainingTime = computed(() => {
    if (props.renderProgress.current === 0 || elapsedSeconds.value === 0) return '--:--'
    const framesPerSecond = props.renderProgress.current / elapsedSeconds.value
    const remainingFrames = props.renderProgress.total - props.renderProgress.current
    const remainingSeconds = Math.ceil(remainingFrames / framesPerSecond)
    const mins = Math.floor(remainingSeconds / 60)
    const secs = remainingSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
})
</script>

<template>
    <div class="config-panel" :class="{ collapsed: isCollapsed }">
        <button class="toggle-btn" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? 'Expand' : 'Collapse'">
            {{ isCollapsed ? '→' : '←' }}
        </button>

        <transition name="slide-fade">
            <div v-if="!isCollapsed" class="panel-content">
                <div class="config-controls">
                    <h3>Settings</h3>

                    <div class="control-group">
                        <label>Threshold</label>
                        <input type="range" min="0" max="255" :value="threshold"
                            @input="emit('update:threshold', Number(($event.target as HTMLInputElement).value))" />
                        <span class="value">{{ threshold }}</span>
                    </div>

                    <div class="control-group">
                        <label>Resolution</label>
                        <input type="range" min="16" max="480" step="1" :value="targetMaxSize"
                            @input="emit('update:targetMaxSize', Number(($event.target as HTMLInputElement).value))" />
                        <div class="resolution-group">
                            <small>{{ renderMeta.width || '-' }} ×</small>
                            <input 
                                type="number" 
                                class="height-input" 
                                :value="editableHeight" 
                                @input="handleHeightInput"
                                min="16"
                                max="360"
                            />
                        </div>
                    </div>

                    <div class="control-group">
                        <label>FPS</label>
                        <input type="range" min="10" max="30" step="1" :value="targetFps"
                            @input="emit('update:targetFps', Number(($event.target as HTMLInputElement).value))" />
                        <small>{{ targetFps }} fps · ~{{ estimatedFrames }} frames</small>
                    </div>

                    <label class="toggle">
                        <input type="checkbox" :checked="invert"
                            @change="emit('update:invert', ($event.target as HTMLInputElement).checked)" />
                        <span>Invert Colors</span>
                    </label>

                    <button class="render-btn" :disabled="isRendering" @click="emit('render')">
                        {{ isRendering ? 'Rendering...' : 'Render' }}
                    </button>

                    <div v-if="isRendering" class="render-progress">
                        <div class="progress-bar" :style="{ width: `${progressPercent}%` }"></div>
                        <span class="progress-text">{{ progressPercent }}%</span>
                    </div>
                    
                    <div v-if="isRendering" class="render-timer">
                        <small>Elapsed: {{ formattedElapsedTime }} · ETA: {{ estimatedRemainingTime }}</small>
                    </div>

                    <div v-if="hasRender" class="download-controls">
                        <h3>Download</h3>
                        <button class="download-btn" @click="emit('download-binary-gzip')">
                            .bin.gz
                        </button>
                        <button class="decoder-btn" @click="emit('download-decoder', 'binary-decoder.js')">
                            Decoder
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.slide-fade-enter-active {
    transition: all 0.3s ease;
}

.slide-fade-leave-active {
    transition: all 0.2s ease;
}

.slide-fade-enter-from {
    opacity: 0;
    transform: translateX(-20px);
}

.slide-fade-leave-to {
    opacity: 0;
    transform: translateX(-10px);
}

.config-panel {
    position: fixed;
    top: 80px;
    left: 16px;
    display: flex;
    gap: 8px;
    z-index: 60;
    transition: all 0.3s ease;
}

.config-panel.collapsed {
    left: 16px;
}

.toggle-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
}

.toggle-btn:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
}

.panel-content {
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 20px;
    backdrop-filter: blur(12px);
    min-width: 240px;
    max-width: 280px;
}

.config-controls,
.download-controls {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.config-controls h3,
.download-controls h3 {
    margin: 0;
    font-size: 13px;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.control-group label {
    font-size: 11px;
    color: #aaa;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.control-group input[type='range'] {
    width: 100%;
    accent-color: #fff;
    height: 4px;
}

.control-group .value {
    font-size: 11px;
    color: #fff;
    font-weight: 600;
}

.control-group small {
    font-size: 10px;
    color: #666;
}

.resolution-group {
    display: flex;
    align-items: center;
    gap: 4px;
}

.height-input {
    width: 60px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: #fff;
    font-size: 10px;
    text-align: center;
}

.height-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.15);
}

.toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #aaa;
    cursor: pointer;
    user-select: none;
}

.toggle input {
    accent-color: #fff;
}

.render-btn {
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    background: #fff;
    color: #000;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.render-btn:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
}

.render-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.render-progress {
    position: relative;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: #fff;
    transition: width 0.2s ease;
}

.progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    font-weight: 700;
    color: #000;
    mix-blend-mode: difference;
}

.render-timer {
    text-align: center;
}

.render-timer small {
    font-size: 9px;
    color: #888;
}

.download-btn {
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    background: #fff;
    color: #000;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.download-btn:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
}

.download-btn,
.decoder-btn {
    border-radius: 6px;
}

.decoder-btn {
    width: 100%;
    padding: 10px 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.decoder-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
}
</style>
