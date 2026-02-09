/**
 * Bad Appleify - Arduino/ESP32 Example
 * Demonstrates how to use the C Header format
 * 
 * 1. Generate C Header (.h) from Bad Appleify
 * 2. Place the .h file in your Arduino project folder
 * 3. #include it and use this code
 */

#include "bad-appleify.h" // Your generated header file

// Example for driving an LED matrix or OLED display
// Adjust according to your hardware

void setup() {
  Serial.begin(115200);
  
  // Initialize your display here
  // e.g., display.begin();
  
  Serial.print("Loaded animation: ");
  Serial.print(BAD_APPLE_WIDTH);
  Serial.print("x");
  Serial.print(BAD_APPLE_HEIGHT);
  Serial.print(" @ ");
  Serial.print(BAD_APPLE_FRAMES);
  Serial.println(" frames");
}

void loop() {
  static uint16_t frameIndex = 0;
  static unsigned long lastFrameTime = 0;
  const uint16_t frameDelay = 1000 / 30; // 30 fps
  
  if (millis() - lastFrameTime >= frameDelay) {
    lastFrameTime = millis();
    
    // Render current frame
    renderFrame(frameIndex);
    
    // Next frame
    frameIndex = (frameIndex + 1) % BAD_APPLE_FRAMES;
  }
}

/**
 * Render a frame to your display
 */
void renderFrame(uint16_t frameIndex) {
  uint32_t frameOffset = frameIndex * BAD_APPLE_BYTES_PER_FRAME;
  
  for (uint8_t y = 0; y < BAD_APPLE_HEIGHT; y++) {
    uint8_t rowBytes = (BAD_APPLE_WIDTH + 7) / 8;
    
    for (uint8_t bx = 0; bx < rowBytes; bx++) {
      // Read byte from PROGMEM
      uint32_t byteOffset = frameOffset + y * rowBytes + bx;
      uint8_t byte = pgm_read_byte(&BAD_APPLE_FRAMES_DATA[byteOffset]);
      
      // Process each bit in the byte
      for (uint8_t bit = 0; bit < 8; bit++) {
        uint8_t x = bx * 8 + bit;
        if (x >= BAD_APPLE_WIDTH) break;
        
        // Get pixel value (MSB first)
        bool isOn = (byte & (0x80 >> bit)) != 0;
        
        // Draw to your display
        // Example for LED matrix:
        // matrix.drawPixel(x, y, isOn ? HIGH : LOW);
        
        // Example for OLED:
        // display.drawPixel(x, y, isOn ? WHITE : BLACK);
      }
    }
  }
  
  // Update display
  // display.display(); // For OLED
  // matrix.show();     // For LED matrix
}

/**
 * Alternative: Get single pixel value
 */
bool getPixel(uint16_t frameIndex, uint8_t x, uint8_t y) {
  if (x >= BAD_APPLE_WIDTH || y >= BAD_APPLE_HEIGHT) return false;
  
  uint8_t rowBytes = (BAD_APPLE_WIDTH + 7) / 8;
  uint32_t byteOffset = frameIndex * BAD_APPLE_BYTES_PER_FRAME 
                        + y * rowBytes 
                        + x / 8;
  
  uint8_t byte = pgm_read_byte(&BAD_APPLE_FRAMES_DATA[byteOffset]);
  uint8_t bitIndex = x % 8;
  
  return (byte & (0x80 >> bitIndex)) != 0;
}
