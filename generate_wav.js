const fs = require('fs');

function createWav(freq, durationMs, filepath) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * (durationMs / 1000));
    const buffer = Buffer.alloc(44 + numSamples * 2);
    
    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    
    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    
    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);
    
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * freq * t) * 32767 * Math.exp(-t * 5); // Decaying sine wave
        buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(sample))), 44 + i * 2);
    }
    
    fs.writeFileSync(filepath, buffer);
}

createWav(600, 300, 'public/chime-1.mp3');
createWav(800, 300, 'public/chime-2.mp3');
createWav(1000, 400, 'public/chime-3.mp3');
createWav(1200, 500, 'public/chime-4.mp3');
createWav(400, 200, 'public/chime-5.mp3');
createWav(500, 200, 'public/chime-6.mp3');
createWav(700, 300, 'public/chime-7.mp3');
createWav(900, 400, 'public/chime-8.mp3');
createWav(300, 100, 'public/click-low.mp3');
createWav(1500, 100, 'public/click-high.mp3');
