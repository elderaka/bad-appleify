<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <div class="stencil-title">
    <h1 class="title-text">{{ text }}</h1>
  </div>
</template>

<style scoped>
.stencil-title {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: none;
  /* Apply blend mode to the entire container so it scans all layers beneath */
  mix-blend-mode: difference;
}

.title-text {
  font-family: 'Press Start 2P', monospace;
  font-size: clamp(20px, 4vw, 36px);
  color: #fff;
  margin: 0;
  padding: 12px 24px;
  /* Layer 3: Scans both layer 1 (video) and layer 2 (rendered) and inverts */
  letter-spacing: 2px;
}
</style>
