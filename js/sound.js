  // ===================== SOUND =====================
  export const SoundManager = {
    ctx: null, enabled: true,
    init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
    resume() { if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} } },
    play(freq, dur, vol = 0.2, type = 'sine') {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = type; osc.frequency.value = freq; gain.gain.value = vol;
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.stop(this.ctx.currentTime + dur);
      } catch (e) {}
    },
    tap() { this.play(700, 0.04, 0.15); },
    paint() { this.play(500, 0.05, 0.18); },
    x() { this.play(400, 0.04, 0.15, 'triangle'); },
    memo() { this.play(900, 0.03, 0.12); },
    error() { this.play(180, 0.15, 0.25, 'sawtooth'); },
    mode() { this.play(850, 0.03, 0.15); },
    lineSolved() { this.play(1200, 0.1, 0.2); setTimeout(() => this.play(1600, 0.1, 0.18), 80); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.play(f, 0.2, 0.25), i * 120)); }
  };
