<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  size: number
  pixelated: boolean
}>()

const isDragging = ref(false)
const isResizing = ref(false)
const isFullscreen = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
// Center window on screen by default
const position = ref({ 
  x: Math.max(0, (window.innerWidth - props.size) / 2), 
  y: Math.max(0, (window.innerHeight - props.size) / 2) 
})
const windowSize = ref(props.size)
const dragStart = ref({ x: 0, y: 0 })
const resizeStartSize = ref(0)

const containerRef = ref<HTMLDivElement | null>(null)

const containerStyle = computed(() => ({
  left: isFullscreen.value ? '0' : `${position.value.x}px`,
  top: isFullscreen.value ? '0' : `${position.value.y}px`,
  width: isFullscreen.value ? '100vw' : `${windowSize.value}px`,
  height: isFullscreen.value ? '100vh' : `${windowSize.value}px`,
}))

// Watch windowSize prop changes
watch(() => props.size, (newSize) => {
  if (!isFullscreen.value && !isResizing.value) {
    windowSize.value = newSize
  }
})

// Dragging
const handleMouseDown = (e: MouseEvent) => {
  if (isFullscreen.value) return
  const target = e.target as HTMLElement
  if (target.classList.contains('resize-handle')) return // Don't drag when clicking resize handle
  
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  dragOffset.value = { ...position.value }
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

const handleTouchStart = (e: TouchEvent) => {
  if (isFullscreen.value || e.touches.length === 0) return
  const target = e.target as HTMLElement
  if (target.classList.contains('resize-handle')) return
  
  isDragging.value = true
  dragStart.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  dragOffset.value = { ...position.value }
  window.addEventListener('touchmove', handleTouchMove)
  window.addEventListener('touchend', handleTouchEnd)
  window.addEventListener('touchcancel', handleTouchEnd)
}

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value && !isFullscreen.value) {
    const deltaX = e.clientX - dragStart.value.x
    const deltaY = e.clientY - dragStart.value.y

    position.value = {
      x: Math.max(0, Math.min(dragOffset.value.x + deltaX, window.innerWidth - windowSize.value)),
      y: Math.max(0, Math.min(dragOffset.value.y + deltaY, window.innerHeight - windowSize.value)),
    }
  } else if (isResizing.value) {
    const delta = Math.max(e.clientX - dragStart.value.x, e.clientY - dragStart.value.y)
    const newSize = Math.max(200, Math.min(resizeStartSize.value + delta, Math.min(window.innerWidth, window.innerHeight)))
    windowSize.value = newSize
    
    position.value = {
      x: Math.max(0, Math.min(position.value.x, window.innerWidth - newSize)),
      y: Math.max(0, Math.min(position.value.y, window.innerHeight - newSize)),
    }
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 0) return
  
  if (isDragging.value && !isFullscreen.value) {
    const deltaX = e.touches[0].clientX - dragStart.value.x
    const deltaY = e.touches[0].clientY - dragStart.value.y

    position.value = {
      x: Math.max(0, Math.min(dragOffset.value.x + deltaX, window.innerWidth - windowSize.value)),
      y: Math.max(0, Math.min(dragOffset.value.y + deltaY, window.innerHeight - windowSize.value)),
    }
  } else if (isResizing.value) {
    const delta = Math.max(e.touches[0].clientX - dragStart.value.x, e.touches[0].clientY - dragStart.value.y)
    const newSize = Math.max(200, Math.min(resizeStartSize.value + delta, Math.min(window.innerWidth, window.innerHeight)))
    windowSize.value = newSize
    
    position.value = {
      x: Math.max(0, Math.min(position.value.x, window.innerWidth - newSize)),
      y: Math.max(0, Math.min(position.value.y, window.innerHeight - newSize)),
    }
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  isResizing.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

const handleTouchEnd = () => {
  isDragging.value = false
  isResizing.value = false
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('touchcancel', handleTouchEnd)
}

// Resize handle
const handleResizeStart = (e: MouseEvent) => {
  if (isFullscreen.value) return
  e.stopPropagation()
  e.preventDefault()
  isResizing.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  resizeStartSize.value = windowSize.value
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

const handleResizeTouchStart = (e: TouchEvent) => {
  if (isFullscreen.value || e.touches.length === 0) return
  e.stopPropagation()
  e.preventDefault()
  isResizing.value = true
  dragStart.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  resizeStartSize.value = windowSize.value
  window.addEventListener('touchmove', handleTouchMove)
  window.addEventListener('touchend', handleTouchEnd)
  window.addEventListener('touchcancel', handleTouchEnd)
}

// Double-click fullscreen toggle
const handleDoubleClick = () => {
  isFullscreen.value = !isFullscreen.value
}

defineExpose({
  containerRef,
  position,
  windowSize,
  isFullscreen,
})
</script>

<template>
  <div ref="containerRef" class="draggable-preview" :class="{ fullscreen: isFullscreen }" :style="containerStyle" 
    @mousedown="handleMouseDown" @touchstart="handleTouchStart"
    @dblclick="handleDoubleClick">
    
    <!-- Viewport window - acts as a mask/stencil -->
    <div class="viewport-window">
      <!-- Portal canvas rendered directly based on window position -->
      <slot />
    </div>

    <!-- Resize handle (bottom-right corner) -->
    <div v-if="!isFullscreen" class="resize-handle" 
      @mousedown="handleResizeStart" 
      @touchstart="handleResizeTouchStart"></div>
  </div>
</template>

<style scoped>
.draggable-preview {
  position: fixed;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
  z-index: 50;
  user-select: none;
  transition: box-shadow 0.2s ease;
  cursor: grab;
  overflow: hidden;
}

.draggable-preview:active {
  cursor: grabbing;
}

.draggable-preview:hover {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.6);
}

.draggable-preview.fullscreen {
  border: none;
  border-radius: 0;
  box-shadow: none;
  cursor: default;
}

.viewport-window {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;
  z-index: 10;
}

.resize-handle::after {
  content: '';
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 0 12px 12px;
  border-color: transparent transparent rgba(255, 255, 255, 0.5) transparent;
}

.resize-handle:hover::after {
  border-color: transparent transparent rgba(255, 255, 255, 0.8) transparent;
}
</style>
