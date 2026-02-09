import { ref } from 'vue'

export interface PreviewData {
  data: Uint8Array // Single flat buffer for all frames
  frameCount: number
  width: number
  height: number
  fps: number
}

// Simple global state to hold large binary data in memory
// This avoids the 5MB sessionStorage limit
export const previewStore = ref<PreviewData | null>(null)

export const setPreviewData = (data: PreviewData) => {
  previewStore.value = data
}

export const clearPreviewData = () => {
  previewStore.value = null
}
