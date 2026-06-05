type Cue = "shot" | "hit" | "death" | "place" | "stair" | "ring" | "wave" | "clear" | "boss" | "defeat" | "victory" | "tick";

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicNodes: OscillatorNode[] = [];
  private musicTimer: number | null = null;
  private muted = false;
  private musicVolume = 0.18;
  private sfxVolume = 0.6;
  private onVolumeChange: ((m: number, s: number) => void) | null = null;

  setVolumeListener(cb: (m: number, s: number) => void): void {
    this.onVolumeChange = cb;
  }

  resume(): void {
    if (!this.ctx) {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxVolume;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.musicVolume;
      this.music.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMusicVolume(v: number): void {
    this.musicVolume = clamp(v, 0, 1);
    if (this.music) this.music.gain.value = this.muted ? 0 : this.musicVolume;
    if (this.onVolumeChange) this.onVolumeChange(this.musicVolume, this.sfxVolume);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp(v, 0, 1);
    if (this.sfx) this.sfx.gain.value = this.muted ? 0 : this.sfxVolume;
    if (this.onVolumeChange) this.onVolumeChange(this.musicVolume, this.sfxVolume);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  getMuted(): boolean {
    return this.muted;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  play(cue: Cue, opts?: { pitch?: number; pan?: number }): void {
    this.resume();
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pitchMul = opts?.pitch ?? 1;
    switch (cue) {
      case "shot": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(620 * pitchMul, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case "hit": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220 * pitchMul, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "death": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }
      case "place": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.1);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      case "stair": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.linearRampToValueAtTime(660, now + 0.15);
        g.gain.setValueAtTime(0.16, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case "ring": {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(660, now);
        osc2.frequency.setValueAtTime(990, now);
        osc1.frequency.linearRampToValueAtTime(880, now + 0.2);
        osc2.frequency.linearRampToValueAtTime(1320, now + 0.2);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(this.sfx);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
        break;
      }
      case "wave": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case "clear": {
        [523.25, 659.25, 783.99].forEach((f, i) => {
          const o = ctx.createOscillator();
          const gg = ctx.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(f, now + i * 0.08);
          gg.gain.setValueAtTime(0.18, now + i * 0.08);
          gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
          o.connect(gg);
          gg.connect(this.sfx!);
          o.start(now + i * 0.08);
          o.stop(now + i * 0.08 + 0.32);
        });
        break;
      }
      case "boss": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.6);
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case "defeat": {
        [330, 220, 110].forEach((f, i) => {
          const o = ctx.createOscillator();
          const gg = ctx.createGain();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(f, now + i * 0.18);
          gg.gain.setValueAtTime(0.2, now + i * 0.18);
          gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.4);
          o.connect(gg);
          gg.connect(this.sfx!);
          o.start(now + i * 0.18);
          o.stop(now + i * 0.18 + 0.4);
        });
        break;
      }
      case "victory": {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const o = ctx.createOscillator();
          const gg = ctx.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(f, now + i * 0.12);
          gg.gain.setValueAtTime(0.22, now + i * 0.12);
          gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
          o.connect(gg);
          gg.connect(this.sfx!);
          o.start(now + i * 0.12);
          o.stop(now + i * 0.12 + 0.4);
        });
        break;
      }
      case "tick": {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(1100, now);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
    }
  }

  startMusic(): void {
    this.resume();
    if (!this.ctx || !this.music) return;
    if (this.musicTimer !== null) return;
    const root = 110;
    const sequence = [0, 4, 7, 4, 0, -3, 4, 7];
    let i = 0;
    const playStep = (): void => {
      if (!this.ctx || !this.music) return;
      const now = this.ctx.currentTime;
      const semis = sequence[i % sequence.length];
      const freq = root * Math.pow(2, semis / 12);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.6, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g);
      g.connect(this.music);
      osc.start(now);
      osc.stop(now + 0.5);
      this.musicNodes.push(osc);
      this.musicNodes = this.musicNodes.filter((o) => {
        try {
          return o.context.state === "running" && now - o.context.currentTime < 1;
        } catch {
          return false;
        }
      });
      i++;
    };
    this.musicTimer = window.setInterval(playStep, 600);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const o of this.musicNodes) {
      try {
        o.stop();
      } catch {
        // ignored
      }
    }
    this.musicNodes = [];
  }

  async destroy(): Promise<void> {
    this.stopMusic();
    if (this.ctx && this.ctx.state !== "closed") {
      try {
        await this.ctx.close();
      } catch {
        // ignored
      }
    }
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.sfx = null;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
