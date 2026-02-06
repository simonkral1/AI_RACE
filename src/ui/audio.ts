// Audio System - Sound effects for UI feedback

const STORAGE_KEY = 'agi_race_audio_enabled';

// Simple synthesized sounds using Web Audio API
// No external audio files needed

class AudioManager {
  private context: AudioContext | null = null;
  private enabled = true;
  private volume = 0.3;

  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  }

  private getContext(): AudioContext | null {
    if (!this.context) {
      try {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        console.warn('Web Audio API not supported');
        return null;
      }
    }
    return this.context;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    fadeOut = true
  ): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!ctx) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);
    if (fadeOut) {
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    }

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }

  private playChord(
    frequencies: number[],
    duration: number,
    type: OscillatorType = 'sine'
  ): void {
    frequencies.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, duration, type), i * 30);
    });
  }

  // UI Sounds

  public click(): void {
    this.playTone(800, 0.05, 'square');
  }

  public hover(): void {
    this.playTone(600, 0.02, 'sine');
  }

  public select(): void {
    this.playTone(1000, 0.08, 'triangle');
  }

  public advance(): void {
    // Rising tone for turn advance
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  }

  public event(): void {
    // Alert tone for events
    this.playChord([523, 659, 784], 0.15, 'triangle'); // C major chord
  }

  public save(): void {
    this.playTone(600, 0.1, 'sine');
    setTimeout(() => this.playTone(800, 0.1, 'sine'), 100);
  }

  public load(): void {
    this.playTone(800, 0.1, 'sine');
    setTimeout(() => this.playTone(600, 0.1, 'sine'), 100);
  }

  public victory(): void {
    // Triumphant arpeggio
    const notes = [523, 659, 784, 1047]; // C, E, G, C
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'triangle'), i * 100);
    });
  }

  public defeat(): void {
    // Descending sad tone
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  }

  public warning(): void {
    // Double beep warning
    this.playTone(440, 0.1, 'square');
    setTimeout(() => this.playTone(440, 0.1, 'square'), 150);
  }

  public research(): void {
    // Sparkle sound for research
    this.playChord([800, 1000, 1200], 0.1, 'sine');
  }

  // Settings

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem(STORAGE_KEY, this.enabled.toString());
    if (this.enabled) {
      this.click(); // Play feedback sound
    }
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem(STORAGE_KEY, enabled.toString());
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

// Singleton instance
let audioManager: AudioManager | null = null;

export const getAudioManager = (): AudioManager => {
  if (!audioManager) {
    audioManager = new AudioManager();
  }
  return audioManager;
};

// Convenience exports
export const playClick = () => getAudioManager().click();
export const playHover = () => getAudioManager().hover();
export const playSelect = () => getAudioManager().select();
export const playAdvance = () => getAudioManager().advance();
export const playEvent = () => getAudioManager().event();
export const playSave = () => getAudioManager().save();
export const playLoad = () => getAudioManager().load();
export const playVictory = () => getAudioManager().victory();
export const playDefeat = () => getAudioManager().defeat();
export const playWarning = () => getAudioManager().warning();
export const playResearch = () => getAudioManager().research();
export const toggleAudio = () => getAudioManager().toggle();
export const isAudioEnabled = () => getAudioManager().isEnabled();
