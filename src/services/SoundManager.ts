// Sound effects generated using Web Audio API for a futuristic retro vibe
export class SoundManager {
    private static ctx: AudioContext | null = null;
    private static isInitialized = false;

    public static init() {
        if (!this.isInitialized) {
            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                    this.isInitialized = true;
                }
            } catch (e) {
                console.warn("AudioContext not supported");
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private static playTone(type: OscillatorType, freqStart: number, freqEnd: number, duration: number, vol: number = 0.1) {
        if (!this.ctx) return;
        try {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type;
            
            o.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
            o.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);

            g.gain.setValueAtTime(vol, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            o.connect(g);
            g.connect(this.ctx.destination);

            o.start();
            o.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Ignore if audio isn't allowed yet
        }
    }

    public static shoot() {
        this.playTone('square', 880, 110, 0.1, 0.05);
    }

    public static enemyShoot() {
        this.playTone('sawtooth', 600, 50, 0.2, 0.04);
    }

    public static shootPower() {
        this.playTone('sawtooth', 1200, 200, 0.15, 0.06);
    }

    public static explosion() {
        this.playTone('sawtooth', 200, 10, 0.3, 0.2);
        // add some noise by playing multiple low frequencies
        this.playTone('square', 150, 10, 0.3, 0.1);
        this.playTone('triangle', 300, 20, 0.25, 0.15);
    }

    public static meteorDestruction() {
        this.playTone('triangle', 100, 20, 0.2, 0.1);
    }

    public static powerup() {
        this.playTone('sine', 440, 1760, 0.3, 0.1);
    }

    public static hit() {
        this.playTone('sawtooth', 300, 50, 0.15, 0.3);
    }

    public static rocket() {
        this.playTone('sawtooth', 100, 800, 0.4, 0.15);
    }
    
    public static shieldOn() {
        this.playTone('sine', 800, 400, 0.2, 0.1);
    }

    public static waveStart() {
        this.playTone('square', 220, 880, 0.4, 0.15);
        setTimeout(() => this.playTone('square', 440, 1760, 0.6, 0.15), 200);
    }
}
