// Tiny WebAudio synth: all sound effects and the music loop are generated at runtime.

type Wave = OscillatorType;

export class Audio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private musicOn = false;
  private musicStep = 0;
  private nextNoteT = 0;
  private tempo = 132;
  private musicTimer: number | null = null;

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, opts: { type?: Wave; vol?: number; slide?: number; delay?: number; bus?: GainNode | null; vib?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + dur);
    if (opts.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vib;
      lg.gain.value = freq * 0.08;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    const v = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(opts.bus ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, opts: { vol?: number; freq?: number; q?: number; type?: BiquadFilterType; delay?: number; sweep?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.sfxBus) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const v = opts.vol ?? 0.3;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  play(name: string) {
    if (!this.ctx) return;
    switch (name) {
      case 'jump':
        this.tone(330, 0.09, { type: 'square', vol: 0.12, slide: 620 });
        break;
      case 'land':
        this.noise(0.06, { vol: 0.18, freq: 500 });
        break;
      case 'die':
        this.noise(0.25, { vol: 0.35, freq: 2200, sweep: 200 });
        this.tone(300, 0.35, { type: 'sawtooth', vol: 0.18, slide: 60 });
        this.noise(0.5, { vol: 0.07, freq: 900, type: 'bandpass', q: 2, delay: 0.08 }); // audience gasp
        break;
      case 'respawn':
        this.tone(520, 0.06, { type: 'triangle', vol: 0.12 });
        this.tone(780, 0.08, { type: 'triangle', vol: 0.1, delay: 0.05 });
        break;
      case 'retry':
        this.tone(400, 0.05, { type: 'square', vol: 0.08, slide: 200 });
        break;
      case 'checkpoint':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.16, delay: i * 0.06 }));
        this.noise(0.6, { vol: 0.04, freq: 3000, type: 'bandpass', q: 0.6, delay: 0.1 }); // applause hiss
        break;
      case 'bagWobble':
        this.tone(90, 0.2, { type: 'square', vol: 0.08, vib: 30, slide: 70 });
        this.noise(0.12, { vol: 0.08, freq: 1800, type: 'bandpass', q: 3 });
        break;
      case 'bagLand':
        this.tone(95, 0.2, { type: 'sine', vol: 0.45, slide: 40 });
        this.noise(0.14, { vol: 0.3, freq: 700 });
        break;
      case 'bagBurst':
        this.noise(0.4, { vol: 0.3, freq: 4000, sweep: 600, type: 'highpass' });
        break;
      case 'trapArm':
        this.tone(140, 0.4, { type: 'square', vol: 0.06, vib: 18, slide: 120 });
        break;
      case 'trapOpen':
        this.noise(0.08, { vol: 0.35, freq: 1500 });
        this.tone(220, 0.14, { type: 'square', vol: 0.12, slide: 90 });
        break;
      case 'liftStart':
        this.tone(60, 1.2, { type: 'sawtooth', vol: 0.09, slide: 140, vib: 12 });
        break;
      case 'liftStop':
        this.noise(0.1, { vol: 0.25, freq: 600 });
        this.tone(110, 0.15, { type: 'square', vol: 0.1 });
        break;
      case 'knightOut':
        this.noise(0.4, { vol: 0.12, freq: 900, type: 'bandpass', q: 4 });
        this.tone(200, 0.12, { type: 'square', vol: 0.08, slide: 300 });
        break;
      case 'knightCrush':
        this.noise(0.25, { vol: 0.3, freq: 1200, sweep: 300 });
        this.tone(160, 0.2, { type: 'sawtooth', vol: 0.12, slide: 50 });
        break;
      case 'bearRoar':
        this.tone(110, 0.6, { type: 'sawtooth', vol: 0.2, vib: 22, slide: 70 });
        this.noise(0.5, { vol: 0.15, freq: 500, type: 'bandpass', q: 1.5 });
        break;
      case 'spotCatch':
        this.noise(0.9, { vol: 0.12, freq: 6000, type: 'highpass' });
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.07, delay: 0.05 + i * 0.07 }));
        break;
      case 'exit':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.16, delay: i * 0.08 }));
        break;
      case 'moverStart':
        this.tone(80, 0.3, { type: 'sawtooth', vol: 0.05, slide: 120 });
        break;
      case 'bump':
        this.tone(160, 0.05, { type: 'square', vol: 0.06, slide: 90 });
        break;
      case 'stuck':
        this.tone(262, 0.18, { type: 'triangle', vol: 0.1, delay: 0.1 });
        this.tone(196, 0.3, { type: 'triangle', vol: 0.1, delay: 0.28 });
        break;
      case 'menu':
        this.tone(660, 0.05, { type: 'square', vol: 0.08 });
        break;
      case 'select':
        this.tone(660, 0.06, { type: 'square', vol: 0.1 });
        this.tone(990, 0.08, { type: 'square', vol: 0.1, delay: 0.05 });
        break;
      case 'curtain':
        this.noise(0.45, { vol: 0.12, freq: 900, sweep: 300 });
        break;
      case 'applause':
        for (let i = 0; i < 10; i++) this.noise(0.25, { vol: 0.06, freq: 2500 + i * 150, type: 'bandpass', q: 1, delay: i * 0.12 });
        break;
    }
  }

  // ---- music: a small vaudeville-ish loop ---------------------------------

  startMusic(tempo = 132) {
    this.tempo = tempo;
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextNoteT = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      while (this.nextNoteT < this.ctx.currentTime + 0.2) {
        this.scheduleStep(this.musicStep, this.nextNoteT);
        this.nextNoteT += 60 / this.tempo / 2;
        this.musicStep = (this.musicStep + 1) % 64;
      }
      this.musicTimer = window.setTimeout(tick, 50);
    };
    tick();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  setTempo(t: number) {
    this.tempo = t;
  }

  private scheduleStep(step: number, t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    // chord roots per bar (4 bars of 16 eighth-steps): C  A-  F  G
    const roots = [48, 45, 41, 43];
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const root = roots[bar];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const note = (m: number, dur: number, type: Wave, vol: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.musicBus!);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    // oom-pah bass
    if (s % 4 === 0) note(root - 12, 0.18, 'triangle', 0.5);
    if (s % 4 === 2) note(root - 5, 0.14, 'triangle', 0.35);
    // off-beat chord stabs
    const third = bar === 1 ? 3 : 4;
    if (s % 4 === 2) {
      note(root + 12, 0.08, 'square', 0.06);
      note(root + 12 + third, 0.08, 'square', 0.05);
      note(root + 19, 0.08, 'square', 0.05);
    }
    // melody (scale degrees relative to C)
    const mel: (number | null)[] = [
      72, null, 76, null, 79, 77, 76, null, 74, null, 72, null, 74, 76, 74, null,
      72, null, 69, null, 72, 74, 76, null, 77, null, 76, null, 72, null, null, null,
      77, null, 81, null, 79, 77, 76, null, 74, null, 76, null, 77, 79, 77, null,
      79, null, 76, null, 74, null, 71, null, 74, 72, 71, null, 67, null, null, null,
    ];
    const m = mel[step];
    if (m !== null && m !== undefined) note(m, 0.2, 'square', 0.07);
    // brushed hat
    if (s % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f).connect(g).connect(this.musicBus);
      src.start(t, (step * 0.013) % 0.5);
      src.stop(t + 0.06);
    }
  }
}
