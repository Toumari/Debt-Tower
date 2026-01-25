
import { ref } from 'vue'
import confetti from 'canvas-confetti'

const isShaking = ref(false)

export function useGameJuice() {

    // --- Visual Effects ---

    function shake(duration = 500) {
        if (isShaking.value) return
        isShaking.value = true
        setTimeout(() => {
            isShaking.value = false
        }, duration)
    }

    function triggerConfetti() {
        // Victory burst
        const count = 200;
        const defaults = {
            origin: { y: 0.7 }
        };

        function fire(particleRatio: number, opts: any) {
            confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio)
            });
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    }

    function triggerSmallConfetti() {
        confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 }
        });
    }

    // --- Sound Effects (Synthesized) ---

    // Simple audio context singleton
    let audioCtx: AudioContext | null = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(freq: number, type: OscillatorType, duration: number, startTime = 0, vol = 0.1) {
        const ctx = initAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    }

    function createNoiseBuffer() {
        const ctx = initAudio();
        const bufferSize = ctx.sampleRate * 2; // 2 seconds
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    let noiseBuffer: AudioBuffer | null = null;

    function playNoise(duration = 0.5, vol = 0.2) {
        const ctx = initAudio();
        if (!noiseBuffer) noiseBuffer = createNoiseBuffer();

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const gain = ctx.createGain();

        // Bandpass filter for "crunchy" sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        noise.start();
        noise.stop(ctx.currentTime + duration);
    }

    function playSfx(type: 'attack' | 'crumble' | 'charge' | 'victory' | 'click' | 'laser' | 'dynamite') {
        try {
            const ctx = initAudio(); // Ensure init

            switch (type) {
                case 'click':
                    playTone(800, 'sine', 0.1, 0, 0.05);
                    break;
                case 'charge':
                    // Rising pitch
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.frequency.setValueAtTime(200, ctx.currentTime);
                    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.3);
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.3);
                    break;
                case 'attack':
                    // Pew pew / impact
                    playTone(150, 'square', 0.1, 0, 0.2);
                    playNoise(0.2, 0.3); // Impact crunch
                    break;
                case 'laser':
                    // ZAP!
                    playTone(2000, 'sawtooth', 0.1, 0, 0.1);
                    playTone(500, 'sawtooth', 0.2, 0.05, 0.1); // Trail off
                    break;
                case 'dynamite':
                    // FUSE... BOOM
                    playTone(800, 'square', 0.1, 0, 0.05); // Fuse spark
                    setTimeout(() => {
                        playNoise(0.8, 0.5); // BIG BOOM
                    }, 100);
                    break;
                case 'crumble':
                    // Low rumble
                    playNoise(0.5, 0.4);
                    break;
                case 'victory':
                    // Major Arpeggio
                    playTone(523.25, 'sine', 0.3, 0); // C5
                    playTone(659.25, 'sine', 0.3, 0.1); // E5
                    playTone(783.99, 'sine', 0.4, 0.2); // G5
                    playTone(1046.50, 'square', 0.6, 0.3, 0.1); // C6
                    triggerConfetti();
                    break;
            }
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    }

    return {
        isShaking,
        shake,
        triggerConfetti,
        triggerSmallConfetti,
        playSfx
    }
}
