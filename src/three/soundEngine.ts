class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.setTargetAtTime(muted ? 0 : 0.045, this.ctx.currentTime, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public startRain(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.rainNode) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.05 * white) / 1.05;
      data[i] = lastOut * 2.4 + white * 0.14;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.55;

    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : 0.045;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.rainNode = src;
    this.rainGain = gain;
  }

  public stopRain(): void {
    if (this.rainNode) {
      try {
        this.rainNode.stop();
        this.rainNode.disconnect();
      } catch {
        // ignore
      }
      this.rainNode = null;
    }
    if (this.rainGain) {
      this.rainGain.disconnect();
      this.rainGain = null;
    }
  }

  public playThunder(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(160, now);
    lp.frequency.exponentialRampToValueAtTime(48, now + 1.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.55);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playGunshot(weaponId: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const isSniper = weaponId === 'awp_viper' || weaponId === 'rail_carbine';
    const isShotgun = weaponId === 'scatter_cannon';
    const isMagnum = weaponId === 'desert_hawk' || weaponId === 'phantom_ak';
    const isSmg = weaponId === 'valkyrie_smg';
    const duration = isSniper ? 0.30 : isShotgun ? 0.24 : isMagnum ? 0.18 : isSmg ? 0.08 : 0.13;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = weaponId === 'rail_carbine' ? 'sawtooth' : 'triangle';
    const startFreq =
      weaponId === 'awp_viper'
        ? 140
        : weaponId === 'rail_carbine'
          ? 440
          : isShotgun
            ? 155
            : isMagnum
              ? 190
              : isSmg
                ? 265
                : 215;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + duration);

    oscGain.gain.setValueAtTime(isSniper || isShotgun ? 0.36 : 0.22, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSniper ? 850 : isShotgun ? 920 : 1680, now);
    filter.Q.setValueAtTime(0.85, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(isSniper || isShotgun ? 0.36 : 0.24, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.28].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 520 : 780, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 280 : 1040, now + offset + 0.055);
      gain.gain.setValueAtTime(0.11, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    });
  }

  public playHitmarker(headshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1480 : 920, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 2100 : 540, now + 0.08);
    gain.gain.setValueAtTime(headshot ? 0.24 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playZombieGroan(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(112, now);
    osc.frequency.linearRampToValueAtTime(74, now + 0.28);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playKill(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.16, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.24);
    });
  }

  public playEmptyClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }
}

export const soundEngine = new SoundEngine();
