use clap::Parser;
use ffmpeg_next as ffmpeg;
use rayon::prelude::*;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::PathBuf;

/// Bad Appleify - Convert videos to bit-packed binary format
#[derive(Parser, Debug)]
#[command(name = "bad-appleify")]
#[command(about = "Convert video files to bit-packed binary format for Bad Apple animations", long_about = None)]
struct Args {
    /// Input video file path
    #[arg(short, long)]
    input: PathBuf,

    /// Output binary file path
    #[arg(short, long, default_value = "output.bin")]
    output: PathBuf,

    /// Target width (video will be scaled)
    #[arg(short, long, default_value_t = 128)]
    width: u32,

    /// Target height (video will be scaled)
    #[arg(short = 'h', long, default_value_t = 96)]
    height: u32,

    /// Threshold for black/white conversion (0-255)
    #[arg(short, long, default_value_t = 128)]
    threshold: u8,

    /// Invert colors (black becomes white)
    #[arg(long)]
    invert: bool,

    /// Target FPS (0 = use video's native FPS)
    #[arg(short, long, default_value_t = 0)]
    fps: u32,

    /// Number of parallel processing threads (0 = auto)
    #[arg(short = 'j', long, default_value_t = 0)]
    threads: usize,
}

/// Pack a single frame into bit-packed format
fn pack_frame(
    frame_rgb: &[u8],
    width: usize,
    height: usize,
    threshold: u8,
    invert: bool,
) -> Vec<u8> {
    let bytes_per_row = (width + 7) / 8;
    let output_size = bytes_per_row * height;
    let mut output = vec![0u8; output_size];

    for y in 0..height {
        for x in 0..width {
            let pixel_idx = (y * width + x) * 3;
            if pixel_idx + 2 >= frame_rgb.len() {
                break;
            }

            let r = frame_rgb[pixel_idx] as u32;
            let g = frame_rgb[pixel_idx + 1] as u32;
            let b = frame_rgb[pixel_idx + 2] as u32;

            // Perceptual luminance (ITU-R BT.601)
            let luminance = ((r * 299 + g * 587 + b * 114) / 1000) as u8;

            let is_active = if invert {
                luminance < threshold
            } else {
                luminance >= threshold
            };

            if is_active {
                let byte_idx = y * bytes_per_row + x / 8;
                let bit_idx = x % 8;
                output[byte_idx] |= 0x80 >> bit_idx;
            }
        }
    }

    output
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Initialize FFmpeg
    ffmpeg::init()?;

    println!("🎬 Bad Appleify - Video to Binary Converter");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("📁 Input:     {}", args.input.display());
    println!("💾 Output:    {}", args.output.display());
    println!("📐 Size:      {}x{}", args.width, args.height);
    println!("🎨 Threshold: {}", args.threshold);
    println!("🔄 Invert:    {}", args.invert);
    println!();

    // Configure thread pool
    if args.threads > 0 {
        rayon::ThreadPoolBuilder::new()
            .num_threads(args.threads)
            .build_global()?;
    }

    // Open video file
    let mut ictx = ffmpeg::format::input(&args.input)?;
    let video_stream = ictx
        .streams()
        .best(ffmpeg::media::Type::Video)
        .ok_or("No video stream found")?;
    let video_stream_index = video_stream.index();

    // Get video info
    let time_base = video_stream.time_base();
    let duration = video_stream.duration() as f64 * f64::from(time_base);
    let native_fps = video_stream.avg_frame_rate();
    let target_fps = if args.fps > 0 {
        args.fps as f64
    } else {
        native_fps.0 as f64 / native_fps.1 as f64
    };
    let total_frames = (duration * target_fps).ceil() as usize;

    println!("📊 Video Info:");
    println!("   Duration:    {:.2}s", duration);
    println!("   Native FPS:  {:.2}", native_fps.0 as f64 / native_fps.1 as f64);
    println!("   Target FPS:  {:.2}", target_fps);
    println!("   Total frames: {}", total_frames);
    println!();

    // Create decoder
    let codec_params = video_stream.parameters();
    let mut decoder = ffmpeg::codec::context::Context::from_parameters(codec_params)?
        .decoder()
        .video()?;

    // Create scaler for resizing
    let mut scaler = ffmpeg::software::scaling::context::Context::get(
        decoder.format(),
        decoder.width(),
        decoder.height(),
        ffmpeg::format::Pixel::RGB24,
        args.width,
        args.height,
        ffmpeg::software::scaling::flag::Flags::BILINEAR,
    )?;

    // Process frames
    let mut frame_idx = 0;
    let mut decoded_frame = ffmpeg::util::frame::Video::empty();
    let mut scaled_frame = ffmpeg::util::frame::Video::empty();
    let mut packed_frames: Vec<Vec<u8>> = Vec::with_capacity(total_frames);

    let mut output_file = BufWriter::new(File::create(&args.output)?);

    print!("🎞️  Processing: [");
    std::io::stdout().flush()?;
    let progress_width = 40;
    let mut last_progress = 0;

    for (stream, packet) in ictx.packets() {
        if stream.index() == video_stream_index {
            decoder.send_packet(&packet)?;

            while decoder.receive_frame(&mut decoded_frame).is_ok() {
                // Scale frame
                scaler.run(&decoded_frame, &mut scaled_frame)?;

                // Get RGB data
                let frame_data = scaled_frame.data(0);

                // Pack frame
                let packed = pack_frame(
                    frame_data,
                    args.width as usize,
                    args.height as usize,
                    args.threshold,
                    args.invert,
                );

                // Write immediately to avoid high memory usage
                output_file.write_all(&packed)?;
                packed_frames.push(packed);

                frame_idx += 1;

                // Update progress bar
                let progress = (frame_idx * progress_width) / total_frames;
                if progress > last_progress {
                    for _ in last_progress..progress {
                        print!("█");
                    }
                    std::io::stdout().flush()?;
                    last_progress = progress;
                }

                if frame_idx >= total_frames {
                    break;
                }
            }
        }

        if frame_idx >= total_frames {
            break;
        }
    }

    // Flush decoder
    decoder.send_eof()?;
    while decoder.receive_frame(&mut decoded_frame).is_ok() {
        scaler.run(&decoded_frame, &mut scaled_frame)?;
        let frame_data = scaled_frame.data(0);
        let packed = pack_frame(
            frame_data,
            args.width as usize,
            args.height as usize,
            args.threshold,
            args.invert,
        );
        output_file.write_all(&packed)?;
        frame_idx += 1;

        let progress = (frame_idx * progress_width) / total_frames;
        if progress > last_progress {
            for _ in last_progress..progress {
                print!("█");
            }
            std::io::stdout().flush()?;
            last_progress = progress;
        }
    }

    // Complete progress bar
    for _ in last_progress..progress_width {
        print!("█");
    }
    println!("]");
    println!();

    output_file.flush()?;

    let bytes_per_frame = ((args.width + 7) / 8 * args.height) as usize;
    let total_size = frame_idx * bytes_per_frame;

    println!("✅ Complete!");
    println!("   Frames processed: {}", frame_idx);
    println!("   Output size:      {:.2} MB", total_size as f64 / 1_048_576.0);
    println!("   Bytes per frame:  {}", bytes_per_frame);
    println!();
    println!("💡 To decode:");
    println!("   Width:  {}", args.width);
    println!("   Height: {}", args.height);
    println!("   Frames: {}", frame_idx);

    Ok(())
}
