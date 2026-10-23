export type Sfx =
  | 'step'
  | 'dash'
  | 'bump'
  | 'swing'
  | 'windup'
  | 'warm'
  | 'pickup'
  | 'hurt'
  | 'seated'
  | 'door'
  | 'win'
  | 'lose'
  | 'bell'
  | 'jump'
  | 'click'
  | 'suction';

/**
 * 全合成音效：不下载任何音频文件，全部由 WebAudio 振荡器/噪声实时生成。
 * 首次用户手势时解锁 AudioContext（浏览器自动播放策略）。
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastStep = 0;
  enabled = true;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    slideTo?: number,
  ): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + duration);
    }
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, duration * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, gain: number, from: number, to: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, to), t0 + duration);
    filter.Q.value = 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
  }

  play(name: Sfx): void {
    if (!this.enabled) return;
    switch (name) {
      case 'step':
        this.tone(220, 0.05, 'square', 0.05);
        break;
      case 'dash':
        this.noise(0.18, 0.12, 900, 240);
        break;
      case 'bump':
        this.tone(120, 0.08, 'square', 0.09, 0, 80);
        break;
      case 'windup':
        this.tone(180, 0.34, 'sawtooth', 0.06, 0, 520);
        break;
      case 'swing':
        this.noise(0.22, 0.2, 2400, 300);
        this.tone(660, 0.12, 'triangle', 0.05, 0.02, 220);
        break;
      case 'warm':
        [880, 1108, 1320].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.09, i * 0.06));
        this.noise(0.3, 0.05, 3000, 800);
        break;
      case 'pickup':
        this.tone(880, 0.08, 'square', 0.07);
        this.tone(1320, 0.1, 'square', 0.06, 0.07);
        break;
      case 'hurt':
        this.tone(300, 0.3, 'sawtooth', 0.12, 0, 70);
        this.noise(0.25, 0.15, 1200, 200);
        break;
      case 'seated':
        this.tone(523, 0.1, 'triangle', 0.08);
        this.tone(784, 0.14, 'triangle', 0.07, 0.09);
        break;
      case 'door':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.06, i * 0.08));
        break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, i * 0.11));
        break;
      case 'lose':
        [440, 392, 330, 247].forEach((f, i) => this.tone(f, 0.32, 'sawtooth', 0.07, i * 0.14));
        break;
      case 'bell':
        [1046, 1318].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.07, i * 0.02));
        this.tone(523, 1.1, 'sine', 0.05, 0.0);
        break;
      case 'jump':
        this.tone(420, 0.14, 'square', 0.06, 0, 760);
        break;
      case 'click':
        this.tone(660, 0.04, 'square', 0.05);
        break;
      case 'suction':
        this.noise(0.4, 0.1, 200, 1600);
        this.tone(180, 0.4, 'sine', 0.07, 0, 520);
        break;
    }
  }

  /** 脚步节流，避免连续密踩噪音 */
  step(now: number): void {
    if (now - this.lastStep < 90) return;
    this.lastStep = now;
    this.play('step');
  }
}
