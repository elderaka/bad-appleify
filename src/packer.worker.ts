import { initWasm, packFrame } from './utils/wasmLoader'
import type { WorkerMessage } from './types'

let ready = false

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data

  try {
    if (type === 'INIT') {
      await initWasm()
      ready = true
      self.postMessage({ type: 'READY' })
    } else if (type === 'PACK_FRAME' && payload) {
      if (!ready) await initWasm()

      const { frameData, width, height, threshold, invert, frameIndex } = payload as {
        frameData: Uint8ClampedArray
        width: number
        height: number
        threshold: number
        invert: boolean
        frameIndex: number
      }

      const packed = packFrame(new Uint8Array(frameData), width, height, threshold, invert)

      // Send back via Transferable for zero-copy
      self.postMessage(
        {
          type: 'FRAME_PACKED',
          payload: {
            frameIndex,
            packed,
          },
        } as WorkerMessage,
        { transfer: [packed.buffer] },
      )
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Worker] Error:', errorMsg)
    self.postMessage({
      type: 'ERROR',
      payload: { message: errorMsg },
    } as WorkerMessage)
  }
}
