# Bad Appleify

## Yes, I used AI for the readme.md because I'm lazy.

A web application that converts video into 1-bit (black and white) packed frames, inspired by the iconic "Bad Apple!!" video.

## Features

- Real-time video preview with adjustable threshold and inversion
- Draggable, resizable portal window for viewing rendered output
- Configurable resolution and FPS settings
- Frame rendering using WebAssembly for optimal performance
- Export to compressed binary format (.bin.gz)
- Includes JavaScript decoder for playback

## Tech Stack

- **Frontend**: Vue 3 + TypeScript
- **Build Tool**: Vite
- **Frame Packing**: Rust compiled to WebAssembly
- **Processing**: Web Workers for non-blocking execution

## Project Setup

```sh
npm install
```

### Build WASM Module

```sh
npm run build-wasm
```

### Development

```sh
npm run dev
```

### Production Build

```sh
npm run build
```

### Lint

```sh
npm run lint
```

### Deployment (Vercel)

```sh
npm install -g vercel
vercel
```
