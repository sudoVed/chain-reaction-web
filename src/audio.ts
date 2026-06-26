let unlocked = false;
let musicEnabled = true;
let sfxEnabled = true;
let wasPlayingBeforeHide = false;

const bgm = new Audio('/assets/bgm.mp3');
bgm.loop = true;
bgm.volume = 0.35;
bgm.preload = 'auto';

const popPool = Array.from({ length: 5 }, () => {
  const audio = new Audio('/assets/pop.mp3');
  audio.volume = 0.55;
  audio.preload = 'auto';
  return audio;
});
let popIndex = 0;

function shouldPlayMusic(): boolean {
  return unlocked && musicEnabled && !document.hidden;
}

function syncMusic(): void {
  if (shouldPlayMusic()) {
    void bgm.play().catch(() => {
      // Browsers can still reject if the gesture unlock was lost.
    });
  } else {
    bgm.pause();
  }
}

export function resumeAudio(): void {
  unlocked = true;
  syncMusic();
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled;
  syncMusic();
}

export function setSfxEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function getAudioSettings(): { musicEnabled: boolean; sfxEnabled: boolean } {
  return { musicEnabled, sfxEnabled };
}

export function playPop(): void {
  if (!unlocked || !sfxEnabled || document.hidden) return;
  const audio = popPool[popIndex];
  popIndex = (popIndex + 1) % popPool.length;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    wasPlayingBeforeHide = !bgm.paused;
    bgm.pause();
    return;
  }
  if (wasPlayingBeforeHide || musicEnabled) {
    syncMusic();
  }
  wasPlayingBeforeHide = false;
});
