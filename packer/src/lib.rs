#![no_std]

// First time using rust no_std, so this is probably not optimal
use core::panic::PanicInfo;
use core::sync::atomic::{AtomicUsize, Ordering};

// 10 MB heap because idk, seems reasonable for image packing
static mut HEAP: [u8; 10_000_000] = [0; 10_000_000];
static HEAP_PTR: AtomicUsize = AtomicUsize::new(0);

#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    let current_ptr = HEAP_PTR.load(Ordering::Relaxed);
    
    // Checking bounds without creating a reference (&HEAP)
    unsafe {
        let heap_start = &raw mut HEAP as *mut u8;
        let heap_size = 10_000_000; 
        
        if current_ptr + size > heap_size {
            return core::ptr::null_mut();
        }

        HEAP_PTR.store(current_ptr + size, Ordering::Relaxed);
        heap_start.add(current_ptr)
    }
}

#[no_mangle]
pub extern "C" fn reset_heap() {
    HEAP_PTR.store(0, Ordering::Relaxed);
}

#[no_mangle]
pub extern "C" fn pack_frame(
    frame_data_ptr: *const u8,
    frame_data_len: usize,
    width: u32,
    height: u32,
    threshold: u8,
    invert: bool,
) -> *mut u8 {
    let width = width as usize;
    let height = height as usize;
    let bytes_per_row = (width + 7) / 8;
    let output_size = bytes_per_row * height;

    // Call our internal alloc
    let output_ptr = alloc(output_size);
    if output_ptr.is_null() {
        return core::ptr::null_mut();
    }

    unsafe {
        let frame_data = core::slice::from_raw_parts(frame_data_ptr, frame_data_len);
        let output = core::slice::from_raw_parts_mut(output_ptr, output_size);
        
        for i in 0..output_size { output[i] = 0; }

        for y in 0..height {
            for x in 0..width {
                let pixel_idx = (y * width + x) * 4;
                if pixel_idx + 2 >= frame_data.len() { break; }

                let r = frame_data[pixel_idx] as u32;
                let g = frame_data[pixel_idx + 1] as u32;
                let b = frame_data[pixel_idx + 2] as u32;

                // Perceputal luminance (ITU-R BT.601)
                let luminance = ((r * 299 + g * 587 + b * 114) / 1000) as u8;

                // Tbh idk how do I get this to work without an if statement
                let is_active = if invert { 
                    luminance < threshold 
                } else { 
                    luminance >= threshold 
                };

                if is_active {
                    let byte_idx = (y * bytes_per_row) + (x / 8);
                    let bit_idx = x % 8;
                    output[byte_idx] |= 0x80 >> bit_idx;
                }
            }
        }
    }
    output_ptr
}

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}