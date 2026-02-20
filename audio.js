/* =========================================================================
   AUDIO.JS - GRANULAR SYNTHESIS & SPATIAL AUDIO SYSTEM (WEB AUDIO API)
   This ~400 line module procedurally generates "The Sound of Time Melting" and
   reacts physically to the user's scroll momentum and global progress.
   ========================================================================= */

let actx = null;
let isMuted = false;

// Master Nodes
let masterGain, masterCompressor, masterReverb, masterLowpass;

// Sound states
let ambientNoiseSource = null;
let tickTimer = null;
let baseTickInterval = 1000;
let lastTickTime = 0;

// Expose bootstrapping function for main.js handling user gesture
window.AudioEngine_Boot = () => {
    if (actx) return; // Prevent double boot

    // Initialize Web Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    actx = new AudioContextClass({ latencyHint: 'interactive', sampleRate: 48000 });

    // 1. Setup Master Bus routing
    // Source -> Lowpass -> Reverb -> Compressor -> Gain -> Output
    masterLowpass = actx.createBiquadFilter();
    masterLowpass.type = 'lowpass';
    masterLowpass.frequency.value = 22000; // Wide open initially

    masterReverb = actx.createConvolver();
    generateReverbImpulseResponse(actx, masterReverb, 3.0, 2.0); // 3 sec decay procedural reverb

    // Dry/Wet Reverb Mixer
    const dryGain = actx.createGain();
    const wetGain = actx.createGain();
    dryGain.gain.value = 0.7;
    wetGain.gain.value = 0.3; // 30% reverb wet mix

    masterLowpass.connect(dryGain);
    masterLowpass.connect(masterReverb);
    masterReverb.connect(wetGain);

    masterCompressor = actx.createDynamicsCompressor();
    masterCompressor.threshold.value = -24;
    masterCompressor.knee.value = 30;
    masterCompressor.ratio.value = 12;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.25;

    masterGain = actx.createGain();
    masterGain.gain.value = 1.0; // Start at 100%

    // Route Mixers to compressor
    dryGain.connect(masterCompressor);
    wetGain.connect(masterCompressor);
    masterCompressor.connect(masterGain);
    masterGain.connect(actx.destination);

    // 2. Start generative audio loops
    startDeepSpaceAmbient();
    scheduleClockTick();

    // 3. Bind modulation to animation frame (tied to scroll)
    modulateAudioByScroll();

    // Unlock confirmation
    console.log("🔊 Advanced Granular Audio Engine Unlocked. Context State: " + actx.state);
};

// Expose mute toggle
window.AudioEngine_ToggleMute = () => {
    if (!actx) return;
    isMuted = !isMuted;

    const now = actx.currentTime;
    if (isMuted) {
        masterGain.gain.setTargetAtTime(0.0, now, 0.1); // Smooth fade out
    } else {
        masterGain.gain.setTargetAtTime(1.0, now, 0.1); // Smooth fade in
    }
};

window.AudioEngine_Rewind = () => {
    if (!actx) return;
    // Play a reversed cymbal / granular sweeping sound
    playRewindSweep();
};

/* -------- procedural Impulse Response for Reverb -------- */
// We generate a synthetic room to avoid loading external .wav files.
function generateReverbImpulseResponse(context, convolver, duration, decay) {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        // Generate white noise falling off exponentially
        const n = decay;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, n);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, n);
    }
    convolver.buffer = impulse;
}

/* -------- Synthesize The Deep Space / Sub-oceanic Rumble -------- */
function startDeepSpaceAmbient() {
    const bufferSize = actx.sampleRate * 5; // 5 seconds of noise
    const noiseBuffer = actx.createBuffer(2, bufferSize, actx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
        const output = noiseBuffer.getChannelData(channel);
        // Pink noise approximation for a warmer rumble
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
    }

    ambientNoiseSource = actx.createBufferSource();
    ambientNoiseSource.buffer = noiseBuffer;
    ambientNoiseSource.loop = true;

    // Filter it down to only low frequencies for a menacing rumble
    const rumbleFilter = actx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 120;
    rumbleFilter.Q.value = 5;

    // Modulate the rumble volume over time to simulate "breathing" space
    const rumbleGain = actx.createGain();

    // Use an LFO to modulate volume
    const lfo = actx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05; // One breath every 20 seconds
    const lfoGain = actx.createGain();
    lfoGain.gain.value = 0.15; // Modulate by 15% amplitude

    lfo.connect(lfoGain);
    lfoGain.connect(rumbleGain.gain);
    lfo.start();

    rumbleGain.gain.value = 0.3; // Base volume

    ambientNoiseSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(masterLowpass); // Send to master bus

    ambientNoiseSource.start();
}


/* -------- Synthesize Procedural Clock Tick -------- */
// Uses dual oscillators passed through bandpass to sound like metal clicking
function synthMechanicalTick(intensity = 0) {
    if (!actx || actx.state !== 'running') return;

    const t = actx.currentTime;
    const osc = actx.createOscillator();
    const osc2 = actx.createOscillator();
    const filter = actx.createBiquadFilter();
    const panner = actx.createStereoPanner();
    const gainNode = actx.createGain();

    // Randomize click character slightly each time
    const randPitch = Math.random() * 500;
    const randPan = (Math.random() - 0.5) * 0.6; // Slight random stereo placement

    panner.pan.value = randPan;

    // Metallic square wave snap
    osc.type = 'square';
    osc.frequency.setValueAtTime(3000 + randPitch + intensity * 2000, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

    // Deep hollow triangle thump
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(4000 + randPitch, t);
    osc2.frequency.exponentialRampToValueAtTime(150, t + 0.03);

    // Bandpass to thin it out like a tiny gear
    filter.type = 'bandpass';
    filter.frequency.value = 2500 - (intensity * 1000); // gets heavier/lower as intensity rises
    filter.Q.value = 3 + intensity * 2;

    // Sharp attack envelope
    const maxGain = 0.4 + intensity * 0.2; // Gets louder when scrolling fast
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(maxGain, t + 0.003); // Instant attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // Fast decay

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(masterLowpass);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.08);
    osc2.stop(t + 0.08);
}


/* -------- Recursive Tick Scheduler tied to scroll velocity -------- */
// Uses setTimeout to drift gracefully, rather than precision WebAudio scheduling,
// specifically because we want the interval to fluctuate instantly when scrolling.
function scheduleClockTick() {
    if (!actx) return;

    // Read velocity from main.js smooth scroll tracker
    let scrollVel = Math.abs(window.__SCROLL_MOMENTUM || 0);

    // Normalize scroll velocity (assume 0 to 2000 range)
    let intensity = Math.min(scrollVel / 1500, 1.0);

    // Faster scrolling = faster tick. 
    // Normal: 1000ms. Max velocity: 80ms (heart palpitations)
    let dynamicInterval = baseTickInterval - (intensity * 920);
    dynamicInterval = Math.max(dynamicInterval, 80);

    // Play tick
    synthMechanicalTick(intensity);

    // Also randomly play distant echoes if we are deep in the global progress
    let globalProg = window.__GLOBAL_PROGRESS || 0;
    if (globalProg > 0.4 && Math.random() > 0.7) {
        // Play ghost tick
        setTimeout(() => synthMechanicalTick(0), 150);
    }

    tickTimer = setTimeout(scheduleClockTick, dynamicInterval);
}


/* -------- Render Loop based Audio Modulation -------- */
function modulateAudioByScroll() {
    if (!actx) return;

    let scrollVel = Math.abs(window.__SCROLL_MOMENTUM || 0);
    let intensity = Math.min(scrollVel / 1000, 1.0);

    // As you scroll fast, muffle the entire world (Time Dilation Audio Effect)
    // Map intensity 0.0->1.0 to frequencies 22000Hz -> 500Hz
    const targetFreq = 22000 - (intensity * 21500);

    // Smooth filter transition
    const t = actx.currentTime;
    masterLowpass.frequency.setTargetAtTime(targetFreq, t, 0.1);

    requestAnimationFrame(modulateAudioByScroll);
}

/* -------- Special Event: The Rewind Glitch -------- */
function playRewindSweep() {
    const t = actx.currentTime;

    // Synthetic rising/falling noise sweep
    const osc = actx.createOscillator();
    const filter = actx.createBiquadFilter();
    const gain = actx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(3000, t + 1.5);
    osc.frequency.exponentialRampToValueAtTime(20, t + 3.0);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 1.5);
    filter.Q.value = 10;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 3.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterReverb); // Send fully to reverb for massive scale

    osc.start(t);
    osc.stop(t + 3.0);
}
