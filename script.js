// Firebase Configuration
const __app_id = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {};
const __initial_auth_token = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : undefined;

// Constants and State
// UPDATED: Increased sample rate to 192,000 Hz to drastically shorten audio duration without data loss.
const AUDIO_SAMPLE_RATE = 192000;
const BYTES_PER_PIXEL = 3;
const METADATA_SIZE = 8;
const MAX_DIMENSION_LIMIT = 50000;

let rawImageData = null;
let imageWidth = 0;
let imageHeight = 0;
let audioData = null;
let isProcessing = false;

// DOM Elements
const encodeSection = document.getElementById('encodeSection');
const decodeSection = document.getElementById('decodeSection');
const btnEncode = document.getElementById('btn-encode');
const btnDecode = document.getElementById('btn-decode');
// Removed statusMessage DOM element

const imageCanvas = document.getElementById('imageCanvas');
const reconstructionCanvas = document.getElementById('reconstructionCanvas');
const reconstructionPlaceholder = document.getElementById('reconstructionPlaceholder');

const convertImageBtn = document.getElementById('convertImageBtn');
const reconstructBtn = document.getElementById('reconstructBtn');
const audioPlayer = document.getElementById('audioPlayer');
const downloadLink = document.getElementById('downloadLink');
const audioOutput = document.getElementById('audioOutput');

const imageInput = document.getElementById('imageInput');
const audioInput = document.getElementById('audioInput');
const imageUploadText = document.getElementById('imageUploadText');
const audioUploadText = document.getElementById('audioUploadText');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imageSizeText = document.getElementById('imageSize');
const progressMessage = document.getElementById('progressMessage');

// --- TAB SWITCHING LOGIC ---
window.switchTab = function (mode) {
    if (mode === 'encode') {
        // Show Encode, Hide Decode
        encodeSection.classList.remove('hidden');
        encodeSection.classList.add('animate-fade-in-up'); // Re-trigger animation

        decodeSection.classList.add('hidden');
        decodeSection.classList.remove('animate-fade-in-up');

        // Update Button Styles
        btnEncode.classList.add('active', 'bg-white/90', 'shadow-md', 'scale-105');
        btnEncode.classList.remove('bg-transparent', 'hover:-translate-y-1');

        btnDecode.classList.remove('active', 'bg-white/90', 'shadow-md', 'scale-105');
        btnDecode.classList.add('hover:-translate-y-1');

        // Removed showStatusMessage call
    } else {
        // Show Decode, Hide Encode
        decodeSection.classList.remove('hidden');
        decodeSection.classList.add('animate-fade-in-up'); // Re-trigger animation

        encodeSection.classList.add('hidden');
        encodeSection.classList.remove('animate-fade-in-up');

        // Update Button Styles
        btnDecode.classList.add('active', 'bg-white/90', 'shadow-md', 'scale-105');
        btnDecode.classList.remove('bg-transparent', 'hover:-translate-y-1');

        btnEncode.classList.remove('active', 'bg-white/90', 'shadow-md', 'scale-105');
        btnEncode.classList.add('hover:-translate-y-1');

        // Removed showStatusMessage call
    }
}

// --- CORE FUNCTIONS ---

window.previewImage = function () {
    const file = imageInput.files[0];
    if (!file) {
        convertImageBtn.disabled = true;
        imagePreviewContainer.classList.add('hidden');
        imageUploadText.textContent = "Click to upload image";
        return;
    }

    imageUploadText.textContent = `Selected: ${file.name}`;
    const ctx = imageCanvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
        imageWidth = img.width;
        imageHeight = img.height;
        imageCanvas.width = imageWidth;
        imageCanvas.height = imageHeight;
        imageCanvas.style.maxWidth = '100%';
        imageCanvas.style.height = 'auto';

        ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
        const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
        const data = imageData.data;
        const rgbData = new Uint8Array(imageWidth * imageHeight * BYTES_PER_PIXEL);

        let rgbIndex = 0;
        for (let i = 0; i < data.length; i += 4) {
            rgbData[rgbIndex++] = data[i];
            rgbData[rgbIndex++] = data[i + 1];
            rgbData[rgbIndex++] = data[i + 2];
        }

        rawImageData = rgbData;
        const totalDataBytes = rawImageData.length + METADATA_SIZE;
        const durationSeconds = (totalDataBytes / AUDIO_SAMPLE_RATE);

        imageSizeText.textContent = `${imageWidth}x${imageHeight} px • ${durationSeconds.toFixed(2)}s Audio`;
        imagePreviewContainer.classList.remove('hidden');
        convertImageBtn.disabled = false;
        audioOutput.classList.add('hidden');
    };

    img.onerror = () => {
        imageUploadText.textContent = "Error loading image.";
        convertImageBtn.disabled = true;
    };
    img.src = URL.createObjectURL(file);
}

function createWavFile(data) {
    const sampleRate = AUDIO_SAMPLE_RATE;
    const numChannels = 1;
    const bitsPerSample = 8;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = data.length + METADATA_SIZE;
    const headerSize = 44;
    const totalFileSize = headerSize + dataSize - 8;

    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);
    let offset = 0;

    function writeString(s) {
        for (let i = 0; i < s.length; i++) {
            view.setUint8(offset + i, s.charCodeAt(i));
        }
        offset += s.length;
    }
    function writeUint32(val) { view.setUint32(offset, val, true); offset += 4; }
    function writeUint16(val) { view.setUint16(offset, val, true); offset += 2; }

    writeString('RIFF'); writeUint32(totalFileSize); writeString('WAVE');
    writeString('fmt '); writeUint32(16); writeUint16(1); writeUint16(numChannels);
    writeUint32(sampleRate); writeUint32(byteRate); writeUint16(blockAlign); writeUint16(bitsPerSample);
    writeString('data'); writeUint32(dataSize);

    view.setUint32(offset, imageWidth, true); offset += 4;
    view.setUint32(offset, imageHeight, true); offset += 4;

    const pcmData = new Uint8Array(buffer, offset);
    for (let i = 0; i < data.length; i++) { pcmData[i] = data[i]; }

    // Use File constructor if available for better filename handling, fallback to Blob
    try {
        return new File([buffer], 'encoded_image_data_color.wav', { type: 'audio/wav' });
    } catch (e) {
        return new Blob([buffer], { type: 'audio/wav' });
    }
}

window.convertToAudio = function () {
    if (!rawImageData || isProcessing) return;
    isProcessing = true;
    convertImageBtn.disabled = true;
    convertImageBtn.innerHTML = '<span class="loading-spinner border-2 w-4 h-4 rounded-full border-t-white border-r-transparent animate-spin mr-2"></span> Processing...';
    audioOutput.classList.add('hidden');

    setTimeout(() => {
        try {
            const wavBlob = createWavFile(rawImageData);
            const audioUrl = URL.createObjectURL(wavBlob);
            audioPlayer.src = audioUrl;

            // Update download link
            downloadLink.href = audioUrl;
            downloadLink.download = 'encoded_image_data_color.wav';

            // Force download with correct filename on click
            downloadLink.onclick = function (e) {
                e.preventDefault();
                const a = document.createElement('a');
                a.href = audioUrl;
                a.download = 'encoded_image_data_color.wav';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };

            audioOutput.classList.remove('hidden');
            audioData = wavBlob;
            audioUploadText.textContent = "Ready to decode generated audio";

        } catch (error) {
            console.error("Error:", error);
        } finally {
            convertImageBtn.textContent = 'Generate Audio File';
            convertImageBtn.disabled = false;
            isProcessing = false;
        }
    }, 300);
}

window.handleAudioUpload = function () {
    const file = audioInput.files[0];
    if (!file) {
        audioUploadText.textContent = "Click to upload encoded WAV";
        reconstructBtn.disabled = true;
        return;
    }
    if (file.type !== 'audio/wav') {
        // Invalid type
        audioInput.value = '';
        return;
    }

    audioUploadText.textContent = `Selected: ${file.name}`;
    const reader = new FileReader();
    reader.onload = (e) => {
        audioData = e.target.result;
        reconstructBtn.disabled = false;
        if (reconstructionPlaceholder) reconstructionPlaceholder.classList.remove('hidden');
        if (reconstructionCanvas) reconstructionCanvas.classList.add('opacity-0');
    };
    reader.readAsArrayBuffer(file);
}

window.reconstructImage = function () {
    if (!audioData || isProcessing) return;
    isProcessing = true;
    reconstructBtn.disabled = true;
    reconstructBtn.innerHTML = '<span class="loading-spinner border-2 w-4 h-4 rounded-full border-t-white border-r-transparent animate-spin mr-2"></span> Reconstructing...';

    if (reconstructionPlaceholder) reconstructionPlaceholder.classList.add('hidden');
    if (reconstructionCanvas) reconstructionCanvas.classList.add('opacity-0');
    if (progressMessage) {
        progressMessage.classList.remove('hidden');
        progressMessage.textContent = "Initializing...";
    }

    try {
        const buffer = new Uint8Array(audioData);
        const dataView = new DataView(buffer.buffer);
        let dataChunkOffset = -1;
        let offset = 12;

        while (offset < buffer.length) {
            if (offset + 8 > buffer.length) break;
            const chunkID = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
            const chunkSize = dataView.getUint32(offset + 4, true);
            if (chunkID === 'data') {
                dataChunkOffset = offset + 8; break;
            }
            offset += 8 + chunkSize;
            if (chunkSize % 2 !== 0) offset += 1;
        }

        if (dataChunkOffset === -1) throw new Error("No data chunk found");

        const payloadStart = dataChunkOffset;
        if (buffer.length < payloadStart + METADATA_SIZE) throw new Error("File too short");

        let reconWidth = dataView.getUint32(payloadStart, true);
        let reconHeight = dataView.getUint32(payloadStart + 4, true);

        if (!Number.isFinite(reconWidth) || reconWidth > MAX_DIMENSION_LIMIT) {
            reconWidth = dataView.getUint32(payloadStart, false);
            reconHeight = dataView.getUint32(payloadStart + 4, false);
        }

        if (reconWidth > MAX_DIMENSION_LIMIT || reconHeight > MAX_DIMENSION_LIMIT) throw new Error("Invalid dimensions");

        const sampleStart = payloadStart + METADATA_SIZE;
        const decodedPixelData = buffer.slice(sampleStart);
        const expectedSamples = reconWidth * reconHeight * BYTES_PER_PIXEL;

        if (decodedPixelData.length !== expectedSamples) throw new Error("Sample mismatch");

        if (reconstructionCanvas) {
            reconstructionCanvas.width = reconWidth;
            reconstructionCanvas.height = reconHeight;
            reconstructionCanvas.style.maxWidth = '100%';
            reconstructionCanvas.style.height = 'auto';
            const ctx = reconstructionCanvas.getContext('2d');
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, reconWidth, reconHeight);

            const finalImageData = ctx.createImageData(reconWidth, reconHeight);
            const finalData = finalImageData.data;

            let row = 0;
            let dataSampleIndex = 0;
            let animationFrameId;
            const samplesPerRow = reconWidth * BYTES_PER_PIXEL;

            reconstructionCanvas.classList.remove('opacity-0');

            const drawLine = () => {
                if (row >= reconHeight || dataSampleIndex >= decodedPixelData.length) {
                    cancelAnimationFrame(animationFrameId);
                    if (progressMessage) progressMessage.textContent = '✨ Reconstruction Complete ✨';
                    reconstructBtn.textContent = 'Reconstruct Image';
                    reconstructBtn.disabled = false;
                    isProcessing = false;
                    return;
                }

                const startIndex = dataSampleIndex;
                const endIndex = Math.min(dataSampleIndex + samplesPerRow, decodedPixelData.length);

                for (let i = startIndex; i < endIndex; i += BYTES_PER_PIXEL) {
                    const r = decodedPixelData[i];
                    const g = decodedPixelData[i + 1];
                    const b = decodedPixelData[i + 2];
                    const pixelInRowIndex = (i - startIndex) / BYTES_PER_PIXEL;
                    const finalIndex = (row * reconWidth + pixelInRowIndex) * 4;

                    finalData[finalIndex] = r;
                    finalData[finalIndex + 1] = g;
                    finalData[finalIndex + 2] = b;
                    finalData[finalIndex + 3] = 255;
                }

                ctx.putImageData(finalImageData, 0, 0);
                dataSampleIndex = endIndex;
                row++;

                if (progressMessage) progressMessage.textContent = `Decoded: ${Math.round((dataSampleIndex / expectedSamples) * 100)}%`;
                animationFrameId = requestAnimationFrame(drawLine);
            };
            requestAnimationFrame(drawLine);
        }

    } catch (error) {
        console.error("Decode Error:", error);
        // Silent failure as requested
        reconstructBtn.textContent = 'Reconstruct Image';
        reconstructBtn.disabled = false;
        isProcessing = false;
        if (progressMessage) progressMessage.classList.add('hidden');
        if (reconstructionPlaceholder) reconstructionPlaceholder.classList.remove('hidden');
    }
}

// Initialize state
document.addEventListener('DOMContentLoaded', () => {
    switchTab('encode');
});
