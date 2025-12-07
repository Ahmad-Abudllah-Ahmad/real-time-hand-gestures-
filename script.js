/**
 * 🪐 PARTICLE TEXT by AAAhmad the dev
 * Interactive particle text with hand gesture control
 */

// =====================================================
// CONFIGURATION
// =====================================================
const CONFIG = {
    particles: {
        sphereCount: 5000,
        ringCount: 3000,
        size: 10,
        sphereRadius: 350,
        ringInnerRadius: 400,
        ringOuterRadius: 600,
        returnSpeed: 0.012
    },
    forces: {
        strength: 20,
        attractRadius: 300
    },
    hand: {
        smoothing: 0.18,
        detectionFPS: 24
    },
    effects: {
        transitionSpeed: 0.04,
        cameraShakeIntensity: 6,
        timeScale: 1.0
    }
};

// Simplified Gesture Types
const GESTURES = {
    NONE: 'none',
    // Single Hand - EASY
    FIST: 'fist',              // Just close your hand
    OPEN: 'open',              // 5 fingers = attract
    TWO_FINGERS: 'two_fingers', // Two fingers = waves
    THREE_FINGERS: 'three_fingers', // Three fingers = text
    FOUR_FINGERS: 'four_fingers', // Four fingers = explosion
    PINCH: 'pinch',            // Thumb + index pinch = draw
    POINT: 'point',            // Point with one finger
    // Dual Hand - EASY
    BOTH_OPEN: 'both_open',
    BOTH_FIST: 'both_fist',
    HANDS_CLOSE: 'hands_close',
    HANDS_FAR: 'hands_far'
};

// =====================================================
// GLOBAL VARIABLES
// =====================================================
let scene, camera, renderer, clock;
let cameraBasePosition = { x: 0, y: 100, z: 700 };
let cameraShake = { x: 0, y: 0 };

let particles, particleGeometry, particleMaterial;
let particlePositions, particleVelocities, originalPositions, particleSizes, particleColors;
let handCanvas, handCtx, previewCanvas, previewCtx;
let hands, videoElement;
let isHandTrackingActive = false;
let starTexture;

// Dual hand tracking
let handData = [
    { landmarks: null, position: { x: 0, y: 0, z: 0 }, smoothed: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, gesture: 'none' },
    { landmarks: null, position: { x: 0, y: 0, z: 0 }, smoothed: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, gesture: 'none' }
];
let combinedGesture = GESTURES.NONE;
let handDistance = 0;

// Effect states
let ringScaleTarget = 1;
let ringScaleCurrent = 1;
let compressionTarget = 0;
let compressionCurrent = 0;
let textPositions = []; // Positions for text formation
let currentMode = 'random'; // 'random', 'wave', 'text', 'draw'
let customText = 'AAAhmad the dev'; // User customizable text

// Drawing with pinch
let drawingTrail = []; // Array of {x, y, z, time} points
let isDrawing = false;
let lastDrawPoint = null;

// Animation
let animationTime = 0;
let noiseTime = 0;

// Timing
let lastHandDetection = 0;
let handDetectionInterval = 1000 / CONFIG.hand.detectionFPS;
let isProcessingHand = false;

// FPS
let frameCount = 0;
let lastFPSUpdate = performance.now();
let fps = 0;

// DOM
let loadingScreen, startBtn, statusDot, statusText, gestureDisplay;

// =====================================================
// NOISE FUNCTION
// =====================================================
function noise(x, y, z) {
    const p = (x * 12.9898 + y * 78.233 + z * 37.719);
    return (Math.sin(p) * 43758.5453) % 1;
}

function smoothNoise(x, y, z) {
    const n1 = noise(Math.floor(x), Math.floor(y), Math.floor(z));
    const n2 = noise(Math.floor(x) + 1, Math.floor(y), Math.floor(z));
    const fx = x - Math.floor(x);
    return lerp(n1, n2, fx);
}

// =====================================================
// CREATE STAR TEXTURE
// =====================================================
function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const c = 32;

    const g1 = ctx.createRadialGradient(c, c, 0, c, c, 32);
    g1.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g1.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
    g1.addColorStop(0.25, 'rgba(220, 240, 255, 0.5)');
    g1.addColorStop(0.5, 'rgba(180, 220, 255, 0.2)');
    g1.addColorStop(1, 'rgba(100, 160, 255, 0)');

    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// =====================================================
// GENERATE TEXT POSITIONS
// =====================================================
function generateTextPositions(text) {
    if (text) customText = text;

    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.font = 'bold 70px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(customText, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    textPositions = [];
    const step = 2; // Denser sampling for clearer text

    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            const i = (y * canvas.width + x) * 4;
            if (data[i + 3] > 128) { // If pixel is visible
                // Map to 3D space centered at origin
                const px = (x - canvas.width / 2) * 0.9;
                const py = -(y - canvas.height / 2) * 0.9;
                const pz = (Math.random() - 0.5) * 20;
                textPositions.push({ x: px, y: py, z: pz });
            }
        }
    }
    console.log('Text positions generated:', textPositions.length);
}

// =====================================================
// INITIALIZATION
// =====================================================
function init() {
    loadingScreen = document.getElementById('loading-screen');
    startBtn = document.getElementById('start-btn');
    statusDot = document.querySelector('.status-dot');
    statusText = document.getElementById('status-text');
    gestureDisplay = document.querySelector('.current-gesture');

    handCanvas = document.getElementById('hand-canvas');
    handCtx = handCanvas.getContext('2d', { alpha: true });

    previewCanvas = document.getElementById('webcam-preview-canvas');
    previewCtx = previewCanvas.getContext('2d', { alpha: true });

    starTexture = createStarTexture();

    generateTextPositions(); // Generate text points

    setupEventListeners();
    initThreeJS();
    initMediaPipe();

    clock = new THREE.Clock();
    requestAnimationFrame(animate);

    setTimeout(() => loadingScreen.classList.add('hidden'), 500);
}

function setupEventListeners() {
    startBtn.addEventListener('click', startCamera);

    // Custom text input
    // Custom text input - Real-time update
    const textInput = document.getElementById('custom-text');

    textInput.addEventListener('input', () => {
        const newText = textInput.value.trim();
        if (newText) {
            generateTextPositions(newText);
        }
    });

    document.getElementById('update-text-btn').addEventListener('click', () => {
        const newText = textInput.value.trim();
        if (newText) {
            generateTextPositions(newText);
        }
    });

    // Also update on Enter key
    document.getElementById('custom-text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const newText = e.target.value.trim();
            if (newText) {
                generateTextPositions(newText);
            }
        }
    });

    document.getElementById('particle-count').addEventListener('input', (e) => {
        document.getElementById('particle-count-value').textContent = e.target.value;
        const total = parseInt(e.target.value);
        CONFIG.particles.sphereCount = Math.floor(total * 0.67);
        CONFIG.particles.ringCount = Math.floor(total * 0.33);
        recreateParticles();
    });

    document.getElementById('force-strength').addEventListener('input', (e) => {
        document.getElementById('force-strength-value').textContent = e.target.value;
        CONFIG.forces.strength = parseInt(e.target.value);
    });

    window.addEventListener('resize', onWindowResize);
}

// =====================================================
// THREE.JS - SATURN SHAPE
// =====================================================
function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(cameraBasePosition.x, cameraBasePosition.y, cameraBasePosition.z);
    camera.lookAt(0, 0, 0);

    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    createParticles();

    handCanvas.width = window.innerWidth;
    handCanvas.height = window.innerHeight;
}

function createParticles() {
    const sphereCount = CONFIG.particles.sphereCount;
    const ringCount = CONFIG.particles.ringCount;
    const total = sphereCount + ringCount;

    particleGeometry = new THREE.BufferGeometry();
    particlePositions = new Float32Array(total * 3);
    particleVelocities = new Float32Array(total * 3);
    originalPositions = new Float32Array(total * 3);
    particleSizes = new Float32Array(total);
    particleColors = new Float32Array(total * 3);

    // START WITH RANDOM SCATTERED POSITIONS
    for (let i = 0; i < total; i++) {
        const i3 = i * 3;

        // Random position in a large cube
        const x = (Math.random() - 0.5) * 1000;
        const y = (Math.random() - 0.5) * 600;
        const z = (Math.random() - 0.5) * 600;

        particlePositions[i3] = x;
        particlePositions[i3 + 1] = y;
        particlePositions[i3 + 2] = z;

        // Original positions = random (will be updated by gestures)
        originalPositions[i3] = x;
        originalPositions[i3 + 1] = y;
        originalPositions[i3 + 2] = z;

        particleSizes[i] = CONFIG.particles.size * (0.5 + Math.random() * 0.7);

        // Random colors - mix of blue, purple, white
        const hue = 0.5 + Math.random() * 0.3;
        const sat = 0.3 + Math.random() * 0.4;
        const light = 0.7 + Math.random() * 0.3;
        const color = new THREE.Color().setHSL(hue, sat, light);
        particleColors[i3] = color.r;
        particleColors[i3 + 1] = color.g;
        particleColors[i3 + 2] = color.b;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: starTexture },
            uTime: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            uniform float uTime;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                float pulse = 1.0 + sin(uTime * 1.5 + position.x * 0.01) * 0.1;
                gl_PointSize = size * pulse * (400.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            varying vec3 vColor;
            void main() {
                vec4 tex = texture2D(uTexture, gl_PointCoord);
                gl_FragColor = vec4(vColor * tex.rgb * 3.0, tex.a);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

function recreateParticles() {
    scene.remove(particles);
    particleGeometry.dispose();
    particleMaterial.dispose();
    createParticles();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    handCanvas.width = window.innerWidth;
    handCanvas.height = window.innerHeight;
}

// =====================================================
// MEDIAPIPE - DUAL HAND
// =====================================================
function initMediaPipe() {
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,  // Lower for easier detection
        minTrackingConfidence: 0.4
    });

    hands.onResults(onHandResults);
}

async function startCamera() {
    try {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="btn-icon">⏳</span> Starting...';
        statusText.textContent = 'Requesting camera...';
        statusDot.className = 'status-dot warning';

        videoElement = document.getElementById('webcam');
        const previewVideo = document.getElementById('webcam-preview-video');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }
        });

        videoElement.srcObject = stream;
        previewVideo.srcObject = stream;

        await videoElement.play();
        await previewVideo.play();

        previewCanvas.width = 640;
        previewCanvas.height = 480;

        document.getElementById('webcam-preview').classList.add('active');

        isHandTrackingActive = true;
        startBtn.innerHTML = '<span class="btn-icon">✅</span> Active';
        statusText.textContent = 'Show your hands!';
        statusDot.className = 'status-dot active';

        requestAnimationFrame(handTrackingLoop);

    } catch (error) {
        console.error('Camera error:', error);
        startBtn.disabled = false;
        startBtn.innerHTML = '<span class="btn-icon">❌</span> Try Again';
        statusText.textContent = 'Camera denied';
        statusDot.className = 'status-dot error';
    }
}

async function handTrackingLoop(timestamp) {
    if (!isHandTrackingActive) return;

    if (timestamp - lastHandDetection >= handDetectionInterval && !isProcessingHand) {
        lastHandDetection = timestamp;
        isProcessingHand = true;
        try { await hands.send({ image: videoElement }); } catch (e) { }
        isProcessingHand = false;
    }

    requestAnimationFrame(handTrackingLoop);
}

// =====================================================
// SIMPLIFIED GESTURE DETECTION
// =====================================================
function onHandResults(results) {
    handData[0].landmarks = null;
    handData[1].landmarks = null;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let h = 0; h < Math.min(results.multiHandLandmarks.length, 2); h++) {
            const lm = results.multiHandLandmarks[h];
            handData[h].landmarks = lm;

            // Palm center
            const palm = {
                x: (lm[0].x + lm[9].x) * 0.5,
                y: (lm[0].y + lm[9].y) * 0.5,
                z: (lm[0].z + lm[9].z) * 0.5
            };

            // Map to 3D space
            const targetX = (1 - palm.x - 0.5) * 1400;
            const targetY = -(palm.y - 0.5) * 1000;
            const targetZ = palm.z * 400;

            // Smooth
            const s = CONFIG.hand.smoothing;
            handData[h].smoothed.x += (targetX - handData[h].smoothed.x) * s;
            handData[h].smoothed.y += (targetY - handData[h].smoothed.y) * s;
            handData[h].smoothed.z += (targetZ - handData[h].smoothed.z) * s;
            handData[h].position = { ...handData[h].smoothed };

            // EASY GESTURE DETECTION
            handData[h].gesture = detectEasyGesture(lm);
        }
    }

    // Calculate hand distance if both hands visible
    if (handData[0].landmarks && handData[1].landmarks) {
        const dx = handData[0].position.x - handData[1].position.x;
        const dy = handData[0].position.y - handData[1].position.y;
        handDistance = Math.sqrt(dx * dx + dy * dy);
    }

    combinedGesture = getCombinedGesture();
}

// SUPER SIMPLE GESTURE DETECTION
function detectEasyGesture(lm) {
    // Count fingers that are UP (very simple check)
    let fingersUp = 0;

    // Index finger up?
    if (lm[8].y < lm[5].y) fingersUp++;
    // Middle finger up?
    if (lm[12].y < lm[9].y) fingersUp++;
    // Ring finger up?
    if (lm[16].y < lm[13].y) fingersUp++;
    // Pinky up?
    if (lm[20].y < lm[17].y) fingersUp++;

    // CHECK FOR PINCH FIRST (thumb tip close to index tip)
    const thumbTip = lm[4];
    const indexTip = lm[8];
    const pinchDist = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // If thumb and index are very close = PINCH for drawing
    if (pinchDist < 0.06) {
        return GESTURES.PINCH;
    }

    // GESTURE RULES:

    // FIST = 0 or 1 fingers up
    if (fingersUp <= 1) {
        return GESTURES.FIST;
    }

    // TWO FINGERS = exactly 2 fingers up -> WAVES
    if (fingersUp === 2) {
        return GESTURES.TWO_FINGERS;
    }

    // THREE FINGERS = exactly 3 fingers up -> TEXT
    if (fingersUp === 3) {
        return GESTURES.THREE_FINGERS;
    }

    // FOUR FINGERS = exactly 4 fingers up -> EXPLOSION
    if (fingersUp === 4) {
        return GESTURES.FOUR_FINGERS;
    }

    // OPEN = 5 fingers (all up) -> Attract
    return GESTURES.OPEN;
}

function getCombinedGesture() {
    const g0 = handData[0].gesture;
    const g1 = handData[1].gesture;
    const hasHand0 = handData[0].landmarks !== null;
    const hasHand1 = handData[1].landmarks !== null;

    // TWO HANDS
    if (hasHand0 && hasHand1) {
        // Both hands open
        if (g0 === GESTURES.OPEN && g1 === GESTURES.OPEN) {
            return GESTURES.BOTH_OPEN;
        }

        // Both fists
        if (g0 === GESTURES.FIST && g1 === GESTURES.FIST) {
            // Close together = crush, far apart = expand
            if (handDistance < 350) {
                return GESTURES.HANDS_CLOSE;
            } else {
                return GESTURES.HANDS_FAR;
            }
        }

        // Both peace signs
        if (g0 === GESTURES.PEACE && g1 === GESTURES.PEACE) {
            return GESTURES.PEACE;
        }

        // Return single hand gesture if one is doing something
        if (g0 !== GESTURES.NONE) return g0;
        if (g1 !== GESTURES.NONE) return g1;
    }

    // SINGLE HAND
    if (hasHand0) return g0;
    if (hasHand1) return g1;

    return GESTURES.NONE;
}

// =====================================================
// PARTICLE PHYSICS
// =====================================================
function updateParticles(dt) {
    const positions = particleGeometry.attributes.position.array;
    const colors = particleGeometry.attributes.color.array;
    const sizes = particleGeometry.attributes.size.array;
    const total = CONFIG.particles.sphereCount + CONFIG.particles.ringCount;
    const sphereCount = CONFIG.particles.sphereCount;

    const strength = CONFIG.forces.strength;
    const radius = CONFIG.forces.attractRadius;
    const radiusSq = radius * radius * 4;
    const returnSpeed = CONFIG.particles.returnSpeed;

    noiseTime += dt * 0.5;

    // Smooth transitions
    ringScaleCurrent = lerp(ringScaleCurrent, ringScaleTarget, CONFIG.effects.transitionSpeed);
    compressionCurrent = lerp(compressionCurrent, compressionTarget, CONFIG.effects.transitionSpeed * 0.5);

    // UPDATE DRAWING TRAIL (Outside particle loop)
    const gesture0 = handData[0].gesture;
    const gesture1 = handData[1].gesture;
    const showingPinch = gesture0 === GESTURES.PINCH || gesture1 === GESTURES.PINCH;

    if (showingPinch) {
        currentMode = 'draw';
        // Find the pinching hand
        for (let h = 0; h < 2; h++) {
            if (handData[h].gesture === GESTURES.PINCH && handData[h].landmarks) {
                const hx = handData[h].position.x;
                const hy = handData[h].position.y;
                const hz = handData[h].position.z;

                // Add this point to drawing trail
                if (!isDrawing || !lastDrawPoint ||
                    Math.abs(hx - lastDrawPoint.x) > 5 ||
                    Math.abs(hy - lastDrawPoint.y) > 5) {
                    drawingTrail.push({ x: hx, y: hy, z: hz, time: animationTime });
                    lastDrawPoint = { x: hx, y: hy, z: hz };
                    isDrawing = true;
                }

                // Limit trail length
                if (drawingTrail.length > 500) {
                    drawingTrail.shift();
                }
            }
        }
    } else {
        isDrawing = false;
        // Fade out drawing trail when not pinching
        if (drawingTrail.length > 0) {
            drawingTrail.shift();
        }
    }

    for (let i = 0; i < total; i++) {
        const i3 = i * 3;
        const isRing = i >= sphereCount;

        let px = positions[i3];
        let py = positions[i3 + 1];
        let pz = positions[i3 + 2];

        let vx = particleVelocities[i3];
        let vy = particleVelocities[i3 + 1];
        let vz = particleVelocities[i3 + 2];

        // GESTURE EFFECTS (applied to ALL particles)
        // Check if any hand is showing gestures
        const showingTwoFingers = gesture0 === GESTURES.TWO_FINGERS || gesture1 === GESTURES.TWO_FINGERS;
        const showingThreeFingers = gesture0 === GESTURES.THREE_FINGERS || gesture1 === GESTURES.THREE_FINGERS;
        const showingFourFingers = gesture0 === GESTURES.FOUR_FINGERS || gesture1 === GESTURES.FOUR_FINGERS;

        if (showingFourFingers) {
            // EXPLOSION EFFECT - particles explode outward from center
            currentMode = 'explosion';
            const dist = Math.sqrt(px * px + py * py + pz * pz) || 1;
            const explosionForce = 2.5;

            // Explode outward
            vx += (px / dist) * explosionForce;
            vy += (py / dist) * explosionForce;
            vz += (pz / dist) * explosionForce;

            // Add randomness for chaotic explosion
            vx += (Math.random() - 0.5) * 1.5;
            vy += (Math.random() - 0.5) * 1.5;
            vz += (Math.random() - 0.5) * 1.5;

            // Fiery colors
            setColor(i3, colors, 1.0, 0.4, 0.1, 0.12);

            // Camera shake for explosion
            cameraShake.x = (Math.random() - 0.5) * CONFIG.effects.cameraShakeIntensity * 1.5;
            cameraShake.y = (Math.random() - 0.5) * CONFIG.effects.cameraShakeIntensity * 1.5;
        } else if (showingThreeFingers && textPositions.length > 0) {
            // TEXT formation - DIRECTLY move particles to text positions
            currentMode = 'text';

            // Keep 15% of particles as background sparkles
            const isBackgroundParticle = (i % 7 === 0);

            if (isBackgroundParticle) {
                // Background particles: gentle floating motion
                const floatX = Math.sin(animationTime * 0.5 + i * 0.1) * 0.5;
                const floatY = Math.cos(animationTime * 0.4 + i * 0.15) * 0.3;
                vx += floatX;
                vy += floatY;
                // Fade them slightly
                setColor(i3, colors, 0.3, 0.5, 0.8, 0.05);
            } else {
                // Text particles: move to text positions
                const textIdx = i % textPositions.length;
                const target = textPositions[textIdx];

                // Direct position lerp - strong force
                positions[i3] = lerp(px, target.x, 0.12);
                positions[i3 + 1] = lerp(py, target.y, 0.12);
                positions[i3 + 2] = lerp(pz, target.z, 0.12);

                // Kill velocity for clean formation
                vx = 0;
                vy = 0;
                vz = 0;

                // Bright golden color for text
                setColor(i3, colors, 1.0, 0.95, 0.4, 0.15);
            }
        } else if (showingTwoFingers) {
            // WAVE effect - DIRECT POSITION LERP (No physics jitter)
            currentMode = 'wave';

            // Calculate target position based on original position + wave offset
            // This guarantees smoothness as it's deterministic, not cumulative
            const ox = originalPositions[i3];
            const oy = originalPositions[i3 + 1];

            const waveOffsetX = Math.sin(animationTime * 2.0 + oy * 0.02) * 20; // Amplitude 20
            const waveOffsetY = Math.cos(animationTime * 1.5 + ox * 0.02) * 20; // Amplitude 20

            const targetX = ox + waveOffsetX;
            const targetY = oy + waveOffsetY;
            const targetZ = originalPositions[i3 + 2]; // Keep Z mostly stable

            // Smoothly move current position to target
            // 0.1 lerp factor gives a nice fluid delay
            positions[i3] = lerp(px, targetX, 0.1);
            positions[i3 + 1] = lerp(py, targetY, 0.1);
            positions[i3 + 2] = lerp(pz, targetZ, 0.1);

            // Kill velocity so physics doesn't fight the lerp
            vx = 0;
            vy = 0;
            vz = 0;

            setColor(i3, colors, 0.3, 0.7, 1.0, 0.08);
        } else {
            // CHECK FOR PINCH DRAWING
            if (showingPinch && drawingTrail.length > 0) {
                // DRAW mode - particles flow toward drawing trail
                const trailIdx = i % drawingTrail.length;
                const target = drawingTrail[trailIdx];

                // Smooth movement to trail point
                const dx = target.x - px;
                const dy = target.y - py;
                const dz = target.z - pz;

                vx += dx * 0.03;
                vy += dy * 0.03;
                vz += dz * 0.01;

                // Glowing cyan color for drawing
                setColor(i3, colors, 0.2, 0.9, 1.0, 0.1);
            }

            // DUAL HAND EFFECTS
            // DUAL HAND EFFECTS
            switch (combinedGesture) {
                case GESTURES.HANDS_CLOSE:
                    // ATTRACT / READY - Fists close = gather particles
                    currentMode = 'attract';
                    compressionTarget = 0.8; // Compress to center

                    // Strong pull to center
                    const ad = Math.sqrt(px * px + py * py + pz * pz) || 1;
                    vx -= px * 0.03;
                    vy -= py * 0.03;
                    vz -= pz * 0.03;

                    // Cyan/Blue energy color for gathering
                    const gatherPulse = Math.sin(animationTime * 5) * 0.2 + 0.8;
                    setColor(i3, colors, 0.2 * gatherPulse, 0.8 * gatherPulse, 1.0, 0.1);
                    break;

                case GESTURES.BOTH_OPEN:
                    // EXPLOSION! - Both hands open = massive explosion
                    currentMode = 'explosion';
                    ringScaleTarget = 2.5;

                    const ed = Math.sqrt(px * px + py * py + pz * pz) || 1;
                    const explosionPower = 4.0; // Stronger explosion

                    // Powerful outward explosion
                    vx += (px / ed) * explosionPower;
                    vy += (py / ed) * explosionPower;
                    vz += (pz / ed) * explosionPower;

                    // Add chaotic randomness
                    vx += (Math.random() - 0.5) * 2.5;
                    vy += (Math.random() - 0.5) * 2.5;
                    vz += (Math.random() - 0.5) * 2.5;

                    // SPARKING EXPLOSION
                    if (Math.random() > 0.7) {
                        setColor(i3, colors, 1.0, 1.0, 0.8, 0.8); // Bright white-yellow
                    } else {
                        setColor(i3, colors, 1.0, 0.4, 0.1, 0.15); // Fiery orange/red
                    }

                    // Camera shake
                    cameraShake.x = (Math.random() - 0.5) * CONFIG.effects.cameraShakeIntensity * 2.5;
                    cameraShake.y = (Math.random() - 0.5) * CONFIG.effects.cameraShakeIntensity * 2.5;
                    break;

                case GESTURES.HANDS_FAR:
                    // Reset / Spread - Hands far apart
                    ringScaleTarget = 1.2;
                    break;

                default:
                    ringScaleTarget = 1.0;
                    compressionTarget = 0;
            }
        }

        // SINGLE HAND EFFECTS
        for (let h = 0; h < 2; h++) {
            if (!handData[h].landmarks) continue;

            const hx = handData[h].position.x;
            const hy = handData[h].position.y;
            const hz = handData[h].position.z;
            const gesture = handData[h].gesture;

            const dx = hx - px;
            const dy = hy - py;
            const dz = hz - pz;
            const distSq = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(distSq);

            if (dist < CONFIG.forces.attractRadius) {
                const force = (1 - dist / CONFIG.forces.attractRadius) * CONFIG.forces.strength;

                switch (gesture) {
                    case GESTURES.FIST:
                        // Attract - pull particles to hand
                        // Vector from P to H is (hx-px, hy-py, hz-pz) = (dx, dy, dz)
                        // Adding this vector moves P towards H
                        vx += dx * force * 0.02;
                        vy += dy * force * 0.02;
                        vz += dz * force * 0.02;
                        setColor(i3, colors, 0.2, 1.0, 0.5, 0.08); // Cyan for attract
                        break;

                    case GESTURES.OPEN:
                        // Repel - push particles away
                        // Subtracting vector moves P away from H
                        vx -= dx * force * 0.02;
                        vy -= dy * force * 0.02;
                        vz -= dz * force * 0.02;
                        setColor(i3, colors, 1.0, 0.2, 0.2, 0.06); // Red for repel
                        break;

                    case GESTURES.POINT:
                        // Beam - directional force
                        vx += dx * force * 0.025;
                        vy += dy * force * 0.025;
                        setColor(i3, colors, 1.0, 1.0, 0.3, 0.08);
                        sizes[i] = lerp(sizes[i], CONFIG.particles.size * 2, 0.1);
                        break;
                }
            }
        }

        // Apply velocity (but not when directly forming text)
        if (!showingThreeFingers) {
            positions[i3] = px + vx;
            positions[i3 + 1] = py + vy - (py * compressionCurrent * 0.015);
            positions[i3 + 2] = pz + vz;
        }

        // Ring scale (only when not forming text)
        if (isRing && !showingThreeFingers) {
            const cr = Math.sqrt(px * px + pz * pz);
            if (cr > 0) {
                const targetR = cr * ringScaleCurrent;
                positions[i3] = lerp(px, px * (targetR / cr), 0.02);
                positions[i3 + 2] = lerp(pz, pz * (targetR / cr), 0.02);
            }
        }

        // Spring back - BUT NOT when forming text, wave, or explosion
        if (!showingThreeFingers && !showingTwoFingers && !showingFourFingers && currentMode !== 'explosion' && currentMode !== 'attract') {
            positions[i3] += (originalPositions[i3] - positions[i3]) * returnSpeed;
            positions[i3 + 1] += (originalPositions[i3 + 1] - positions[i3 + 1]) * returnSpeed;
            positions[i3 + 2] += (originalPositions[i3 + 2] - positions[i3 + 2]) * returnSpeed;
        }

        // Damping - stronger for explosion
        const damping = (showingFourFingers || currentMode === 'explosion') ? 0.96 : 0.92;
        particleVelocities[i3] = vx * damping;
        particleVelocities[i3 + 1] = vy * damping;
        particleVelocities[i3 + 2] = vz * damping;

        // Restore colors when no gesture
        if (!showingThreeFingers && !showingTwoFingers && !showingFourFingers && combinedGesture === GESTURES.NONE && !showingPinch) {
            restoreColor(i, i3, colors, isRing);
            const baseSize = CONFIG.particles.size * (isRing ? 0.35 : 0.6);
            sizes[i] = lerp(sizes[i], baseSize, 0.02);
        }
    }

    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    particleGeometry.attributes.size.needsUpdate = true;
}

function setColor(i3, colors, r, g, b, t) {
    colors[i3] = lerp(colors[i3], r, t);
    colors[i3 + 1] = lerp(colors[i3 + 1], g, t);
    colors[i3 + 2] = lerp(colors[i3 + 2], b, t);
}

function restoreColor(i, i3, colors, isRing) {
    let r, g, b;
    if (isRing) {
        r = 0.85; g = 0.92; b = 1.0;
    } else {
        r = 1.0; g = 0.85; b = 0.65;
    }
    colors[i3] = lerp(colors[i3], r, 0.01);
    colors[i3 + 1] = lerp(colors[i3 + 1], g, 0.01);
    colors[i3 + 2] = lerp(colors[i3 + 2], b, 0.01);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// =====================================================
// CAMERA SHAKE
// =====================================================
function updateCameraShake() {
    const intensity = CONFIG.effects.cameraShakeIntensity;
    let shake = 0;

    if (combinedGesture === GESTURES.HANDS_FAR) shake = 0.8;
    else if (combinedGesture === GESTURES.HANDS_CLOSE) shake = 0.5;
    else if (handData[0].gesture === GESTURES.FIST || handData[1].gesture === GESTURES.FIST) shake = 0.3;

    if (shake > 0) {
        cameraShake.x = (Math.random() - 0.5) * intensity * shake;
        cameraShake.y = (Math.random() - 0.5) * intensity * shake;
    } else {
        cameraShake.x = lerp(cameraShake.x, 0, 0.1);
        cameraShake.y = lerp(cameraShake.y, 0, 0.1);
    }

    camera.position.x = cameraBasePosition.x + cameraShake.x;
    camera.position.y = cameraBasePosition.y + cameraShake.y;
}

// =====================================================
// DRAW HANDS
// =====================================================
function drawHands() {
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    const colors = ['#00ccff', '#ff00cc'];

    for (let h = 0; h < 2; h++) {
        if (!handData[h].landmarks) continue;
        drawHand(previewCtx, handData[h].landmarks, previewCanvas.width, previewCanvas.height, true, colors[h]);
        drawHand(handCtx, handData[h].landmarks, handCanvas.width, handCanvas.height, false, colors[h]);
    }
}

function drawHand(ctx, lm, w, h, isPreview, color) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]
    ];

    ctx.strokeStyle = color + (isPreview ? 'cc' : '55');
    ctx.lineWidth = isPreview ? 2 : 3;

    ctx.beginPath();
    for (const [a, b] of connections) {
        ctx.moveTo((isPreview ? lm[a].x : 1 - lm[a].x) * w, lm[a].y * h);
        ctx.lineTo((isPreview ? lm[b].x : 1 - lm[b].x) * w, lm[b].y * h);
    }
    ctx.stroke();

    for (let i = 0; i < 21; i++) {
        const x = (isPreview ? lm[i].x : 1 - lm[i].x) * w;
        const y = lm[i].y * h;
        const isTip = [4, 8, 12, 16, 20].includes(i);
        ctx.beginPath();
        ctx.arc(x, y, isPreview ? (isTip ? 5 : 3) : (isTip ? 8 : 4), 0, Math.PI * 2);
        ctx.fillStyle = isTip ? '#fff' : color;
        ctx.fill();
    }
}

// =====================================================
// UI
// =====================================================
function updateUI() {
    const names = {
        [GESTURES.NONE]: 'Show your hands!',
        [GESTURES.FIST]: '✊ Fist → Attract',
        [GESTURES.TWO_FINGERS]: '✌️ 2 Fingers → Waves',
        [GESTURES.THREE_FINGERS]: '🤟 3 Fingers → TEXT',
        [GESTURES.FOUR_FINGERS]: '💥 4 Fingers → Explode',
        [GESTURES.OPEN]: '🖐️ 5 Fingers → Repel',
        [GESTURES.PINCH]: '🤏 Pinch → DRAW',
        [GESTURES.POINT]: '👆 Point → Beam',
        [GESTURES.BOTH_OPEN]: '🖐️🖐️ Both Open → EXPLODE!',
        [GESTURES.BOTH_FIST]: '✊✊ Both Fists',
        [GESTURES.HANDS_CLOSE]: '✊✊ Fists Close → GATHER',
        [GESTURES.HANDS_FAR]: '👐 Hands Apart → Spread'
    };

    gestureDisplay.textContent = names[combinedGesture] || combinedGesture;

    const handCount = (handData[0].landmarks ? 1 : 0) + (handData[1].landmarks ? 1 : 0);
    statusText.textContent = handCount > 0 ? `${handCount} hand${handCount > 1 ? 's' : ''} detected` : 'Show your hands!';

    // Highlight active gesture chip
    document.querySelectorAll('.gesture-chip').forEach(chip => {
        const g = chip.dataset.gesture;
        chip.classList.toggle('active',
            combinedGesture === g ||
            handData[0].gesture === g ||
            handData[1].gesture === g
        );
    });
}

// =====================================================
// ANIMATION LOOP
// =====================================================
function animate(timestamp) {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    animationTime += dt;

    // FPS
    frameCount++;
    if (timestamp - lastFPSUpdate >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFPSUpdate = timestamp;
        document.getElementById('fps-value').textContent = fps;
    }

    // Check if showing text
    const gesture0 = handData[0].gesture;
    const gesture1 = handData[1].gesture;
    const showingText = gesture0 === GESTURES.THREE_FINGERS || gesture1 === GESTURES.THREE_FINGERS;

    // Rotate particles (but NOT when showing text)
    if (particles) {
        if (showingText) {
            // Smoothly reset to face camera when showing text
            particles.rotation.y = lerp(particles.rotation.y, 0, 0.05);
            particles.rotation.x = lerp(particles.rotation.x, 0, 0.05);
        } else {
            particles.rotation.y += 0.002;
            particles.rotation.x = Math.sin(animationTime * 0.15) * 0.05 + 0.18;
        }
    }

    // Shader
    if (particleMaterial.uniforms) {
        particleMaterial.uniforms.uTime.value = animationTime;
    }

    // Physics
    updateParticles(dt);

    // Camera
    updateCameraShake();

    // Draw
    drawHands();
    updateUI();

    // Render
    renderer.render(scene, camera);
}

// =====================================================
// START
// =====================================================
document.addEventListener('DOMContentLoaded', init);
