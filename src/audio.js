// WebAudio: streamed-decoded music loops with crossfades, synthesized SFX, crowd samples.
const MUSIC = { title: 'assets/music/title.mp3', happy: 'assets/music/happy.mp3', action: 'assets/music/action.mp3', epic: 'assets/music/epic.mp3', tense: 'assets/music/tense.mp3', sneaky: 'assets/music/sneaky.mp3', chase: 'assets/music/chase.mp3' };
const SAMPLES = { crowd: 'assets/sfx/amb-crowd.mp3', laugh: 'assets/sfx/laugh-crowd.mp3' };

class AudioSys {
  constructor() {
    this.ctx = null; this.want = null; this.cur = null; this.bufs = {}; this.loading = {};
    this.musicVol = 0.5; this.sfxVol = 0.8; this.noiseBuf = null; this.last = {};
  }
  // call on every pad press: creates/resumes the context (it may start suspended)
  resume() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        if (this.want) this.music(this.want);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) { /* audio is optional */ }
  }
  get ok() { return this.ctx && this.ctx.state === 'running'; }

  async buffer(key, url) {
    if (this.bufs[key]) return this.bufs[key];
    if (!this.loading[key]) {
      this.loading[key] = fetch(url).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej))).then((b) => (this.bufs[key] = b)).catch(() => null);
    }
    return this.loading[key];
  }

  async music(name, { fade = 1.0, vol = 1 } = {}) {
    this.want = name;
    if (!this.ctx) return;
    if (this.cur && this.cur.name === name) { this.cur.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2); return; }
    const buf = await this.buffer('m:' + name, MUSIC[name]);
    if (!buf || this.want !== name || (this.cur && this.cur.name === name)) return;
    const t = this.ctx.currentTime;
    if (this.cur) { const o = this.cur; o.gain.gain.cancelScheduledValues(t); o.gain.gain.setTargetAtTime(0, t, fade / 3); try { o.src.stop(t + fade * 1.5); } catch (e) {} }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const gain = this.ctx.createGain(); gain.gain.value = 0; gain.gain.setTargetAtTime(vol, t, fade / 3);
    src.connect(gain); gain.connect(this.musicBus); src.start();
    this.cur = { name, src, gain };
  }
  stopMusic(fade = 0.8) {
    this.want = null;
    if (!this.ctx || !this.cur) return;
    const o = this.cur; this.cur = null; const t = this.ctx.currentTime;
    o.gain.gain.setTargetAtTime(0, t, fade / 3); try { o.src.stop(t + fade * 1.5); } catch (e) {}
  }
  duck(v = 0.35, sec = 0.8) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(this.musicVol * v, t, 0.05); this.musicBus.gain.setTargetAtTime(this.musicVol, t + sec, 0.4);
  }

  // ---- synthesis helpers
  tone(freq, dur, { type = 'square', vol = 0.2, slide = 0, delay = 0, attack = 0.005, bus = null } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, { vol = 0.3, f0 = 2000, f1 = 400, q = 1, type = 'lowpass', delay = 0, attack = 0.005 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }
  async sample(key, { vol = 0.5, rate = 1, dur = 0 } = {}) {
    if (!this.ok) return;
    const b = await this.buffer('s:' + key, SAMPLES[key]);
    if (!b) return;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime; g.gain.setValueAtTime(vol, t);
    const len = dur || Math.min(b.duration, 2.2); g.gain.setTargetAtTime(0, t + len * 0.7, len * 0.12);
    s.connect(g); g.connect(this.sfxBus); s.start(t, Math.random() * Math.max(0, b.duration - len)); s.stop(t + len + 0.5);
  }

  sfx(name, o = {}) {
    if (!this.ok) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return; this.last[name] = now;
    const p = o.pitch || 1;
    switch (name) {
      case 'jump': this.tone(300 * p, 0.16, { type: 'sine', vol: 0.3, slide: 420 }); break;
      case 'djump': this.tone(450 * p, 0.18, { type: 'sine', vol: 0.3, slide: 560 }); this.tone(900 * p, 0.1, { type: 'triangle', vol: 0.1, delay: 0.04 }); break;
      case 'land': this.noise(0.12, { vol: 0.25, f0: 700, f1: 120 }); break;
      case 'dash': this.noise(0.26, { vol: 0.35, f0: 600, f1: 5000, type: 'bandpass', q: 1.5, attack: 0.05 }); this.tone(180, 0.2, { type: 'sawtooth', vol: 0.08, slide: 200 }); break;
      case 'hit': this.noise(0.14, { vol: 0.6, f0: 1800, f1: 150 }); this.tone(130 * p, 0.2, { type: 'sine', vol: 0.55, slide: -70 }); this.tone(420, 0.06, { type: 'square', vol: 0.12 }); break;
      case 'slam': this.noise(0.55, { vol: 0.8, f0: 900, f1: 60 }); this.tone(80, 0.5, { type: 'sine', vol: 0.9, slide: -50 }); break;
      case 'dive': this.tone(700, 0.3, { type: 'sawtooth', vol: 0.12, slide: -520 }); break;
      case 'shove': this.noise(0.1, { vol: 0.35, f0: 1200, f1: 300, type: 'bandpass' }); break;
      case 'crown': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.25, delay: i * 0.07 })); this.tone(1760, 0.5, { type: 'sine', vol: 0.12, delay: 0.2 }); break;
      case 'steal': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.16, delay: i * 0.07 })); this.sample('crowd', { vol: 0.35, dur: 1.6 }); break;
      case 'drop': this.tone(500, 0.25, { type: 'triangle', vol: 0.25, slide: -300 }); break;
      case 'power': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, { type: 'square', vol: 0.12, delay: i * 0.05 })); break;
      case 'spawn': this.tone(880, 0.12, { type: 'sine', vol: 0.12 }); this.tone(1320, 0.18, { type: 'sine', vol: 0.12, delay: 0.1 }); break;
      case 'beep': this.tone(o.high ? 880 : 440, o.high ? 0.5 : 0.2, { type: 'square', vol: 0.22 }); break;
      case 'go': this.tone(880, 0.6, { type: 'square', vol: 0.25 }); this.tone(1320, 0.6, { type: 'triangle', vol: 0.2 }); this.sample('crowd', { vol: 0.5, dur: 2 }); break;
      case 'shield': this.tone(900, 0.15, { type: 'sine', vol: 0.3, slide: -600 }); this.noise(0.2, { vol: 0.3, f0: 6000, f1: 800, type: 'highpass' }); break;
      case 'shield-on': this.tone(400, 0.3, { type: 'sine', vol: 0.2, slide: 500 }); break;
      case 'ringout': this.tone(1200, 0.7, { type: 'sine', vol: 0.25, slide: -1000 }); this.sample('laugh', { vol: 0.3, dur: 1.2 }); break;
      case 'frenzy': [330, 330, 440, 330, 494].forEach((f, i) => this.tone(f, 0.2, { type: 'sawtooth', vol: 0.15, delay: i * 0.12 })); break;
      case 'time': this.tone(220, 0.8, { type: 'square', vol: 0.3, slide: -40 }); this.noise(0.8, { vol: 0.2, f0: 3000, f1: 500 }); break;
      case 'menu': this.tone(520, 0.06, { type: 'square', vol: 0.12 }); break;
      case 'select': this.tone(660, 0.08, { type: 'square', vol: 0.15 }); this.tone(990, 0.1, { type: 'square', vol: 0.15, delay: 0.06 }); break;
      case 'back': this.tone(400, 0.1, { type: 'square', vol: 0.15, slide: -150 }); break;
      case 'ready': [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.22, delay: i * 0.06 })); break;
      case 'join': this.tone(440, 0.1, { type: 'triangle', vol: 0.22 }); this.tone(880, 0.16, { type: 'triangle', vol: 0.22, delay: 0.07 }); break;
      case 'tick': this.tone(1000, 0.04, { type: 'square', vol: 0.1 }); break;
      case 'fanfare': [523, 523, 523, 698, 659, 698, 880].forEach((f, i) => this.tone(f, i === 6 ? 0.6 : 0.16, { type: 'square', vol: 0.18, delay: i * 0.13 })); this.sample('crowd', { vol: 0.5, dur: 2.2 }); break;
      case 'taunt': this.tone(600, 0.1, { type: 'triangle', vol: 0.2, slide: 300 }); this.tone(800, 0.12, { type: 'triangle', vol: 0.2, delay: 0.1, slide: -200 }); break;
      case 'bounce': this.tone(900, 0.08, { type: 'sine', vol: 0.15, slide: -200 }); break;
      case 'warn': this.tone(300, 0.15, { type: 'sawtooth', vol: 0.12 }); break;
      default: break;
    }
  }
}
export const audio = new AudioSys();
