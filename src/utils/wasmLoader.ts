// WASM Module Loader for bad-apple-packer
// Simplified approach: use wasm-bindgen generated glue (we'll generate it manually)

interface WasmExports {
  memory: WebAssembly.Memory
  alloc: (size: number) => number
  reset_heap: () => void
  pack_frame: (
    frameDataPtr: number,
    frameDataLen: number,
    width: number,
    height: number,
    threshold: number,
    invert: number,
  ) => number
}

let wasmInstance: WebAssembly.Instance | null = null
let wasmMemory: WebAssembly.Memory | null = null
let wasmExports: WasmExports | null = null

export async function initWasm(): Promise<void> {
  if (wasmInstance) return

  try {
    // Fetch the compiled WASM binary
    const response = await fetch(new URL('../assets/wasm/bad_apple_packer.wasm', import.meta.url))
    const wasmBuffer = await response.arrayBuffer()

    // Provide imports object (memory will be exported by the module)
    const imports = {
      wasi_snapshot_preview1: {
        proc_exit: () => {},
        environ_sizes_get: () => 0,
        environ_get: () => 0,
        fd_write: () => 0,
        fd_close: () => 0,
      },
    }

    // Instantiate the module with imports
    const { instance } = await WebAssembly.instantiate(wasmBuffer, imports)

    wasmInstance = instance
    wasmExports = instance.exports as unknown as WasmExports
    wasmMemory = wasmExports.memory

    console.log('[Packer] WASM initialized', Object.keys(wasmExports))
  } catch (error) {
    console.error('[Packer] Failed to initialize WASM:', error)
    throw error
  }
}

export function packFrame(
  frameData: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  invert: boolean,
): Uint8Array {
  if (!wasmInstance || !wasmMemory || !wasmExports) {
    throw new Error('WASM module not initialized. Call initWasm() first.')
  }

  if (!wasmExports.pack_frame || !wasmExports.alloc || !wasmExports.reset_heap) {
    throw new Error('Required WASM exports not found')
  }

  // Reset heap to avoid unbounded growth
  wasmExports.reset_heap()

  // Allocate input buffer and copy frame data
  const memBuffer = new Uint8Array(wasmMemory.buffer)
  const dataPtr = wasmExports.alloc(frameData.length)
  if (dataPtr === 0) {
    throw new Error('WASM alloc failed')
  }
  memBuffer.set(frameData, dataPtr)

  // Call pack_frame(data_ptr, data_len, width, height, threshold, invert)
  const resultPtr = wasmExports.pack_frame(
    dataPtr,
    frameData.length,
    width,
    height,
    threshold,
    invert ? 1 : 0,
  )

  // Calculate packed size: ceil(width / 8) * height
  const bytesPerRow = Math.ceil(width / 8)
  const packedSize = bytesPerRow * height

  // Read result from memory
  const result = new Uint8Array(memBuffer.buffer, resultPtr, packedSize)
  return new Uint8Array(result) // Copy to detach from shared memory
}
