// main.ts — Entry point. Init, rAF loop, event routing, state machine.
// Port of main.py.

import { Game } from './game';
import { GameRenderer } from './renderer';
import { SetupScreen, Settings } from './setup-screen';
import { getAudioSettings, resumeAudio, playPop, setMusicEnabled, setSfxEnabled } from './audio';
import { AIPlayer, AIMode } from './ai/player';

const AI_MOVE_DELAY = 500; // ms

// ------------------------------------------------------------------
// Resize
// ------------------------------------------------------------------

function resizeCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ------------------------------------------------------------------
// Loading overlay
// ------------------------------------------------------------------

function setLoadingText(text: string): void {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = text;
}

function showLoadingError(msg: string): void {
  const el = document.getElementById('loading-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideLoading(): void {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

// ------------------------------------------------------------------
// Event pos extraction
// ------------------------------------------------------------------

function getPos(canvas: HTMLCanvasElement, e: MouseEvent | Touch): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

type AppState =
  | { kind: 'setup'; screen: SetupScreen }
  | { kind: 'game'; renderer: GameRenderer; settings: Settings }
  | { kind: 'ai_game'; renderer: GameRenderer; settings: Settings; ai: AIPlayer; aiTimer: number };

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  resizeCanvas(canvas);

  let appState: AppState;

  // --------------------------------------------------------------
  // Setup screen
  // --------------------------------------------------------------
  const setupScreen = new SetupScreen(canvas);
  appState = { kind: 'setup', screen: setupScreen };
  setLoadingText('Click to start');
  hideLoading();

  // --------------------------------------------------------------
  // Event listeners
  // --------------------------------------------------------------

  canvas.addEventListener('mousemove', (e) => {
    const pos = getPos(canvas, e);
    if (appState.kind === 'setup') {
      appState.screen.handleMouseMove(pos);
    } else {
      appState.renderer.handleMouseMove(pos);
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    resumeAudio();
    const pos = getPos(canvas, e);
    if (appState.kind === 'setup') {
      const result = appState.screen.handleClick(pos);
      setMusicEnabled(appState.screen.musicEnabled);
      setSfxEnabled(appState.screen.sfxEnabled);
      if (result) {
        startGame(result);
      }
    } else if (appState.kind === 'game') {
      appState.renderer.handleClick(pos);
      handleRendererChrome(appState.renderer);
    } else if (appState.kind === 'ai_game') {
      const g = appState.renderer.game;
      appState.renderer.handleClick(pos, g.currentPlayer === 0);
      handleRendererChrome(appState.renderer);
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    resumeAudio();
    const touch = e.touches[0];
    const pos = getPos(canvas, touch);
    if (appState.kind === 'setup') {
      appState.screen.handleMouseMove(pos);
      const result = appState.screen.handleClick(pos);
      setMusicEnabled(appState.screen.musicEnabled);
      setSfxEnabled(appState.screen.sfxEnabled);
      if (result) {
        startGame(result);
      }
    } else if (appState.kind === 'game') {
      appState.renderer.handleMouseMove(pos);
      appState.renderer.handleClick(pos);
      handleRendererChrome(appState.renderer);
    } else if (appState.kind === 'ai_game') {
      appState.renderer.handleMouseMove(pos);
      const g = appState.renderer.game;
      appState.renderer.handleClick(pos, g.currentPlayer === 0);
      handleRendererChrome(appState.renderer);
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (appState.kind === 'setup') {
      if (key === 'escape') {
        // nothing on setup
      }
      return;
    }
    const renderer = appState.renderer;
    if (key === 'escape') {
      returnToMenu();
      return;
    }
    if (key === 'r' && renderer.game.state === 'won') {
      restartSameGame();
      return;
    }
    if (appState.kind === 'game' || (appState.kind === 'ai_game' && renderer.game.currentPlayer === 0)) {
      renderer.handleKey(key);
    }
    handleRendererChrome(renderer);
  });

  window.addEventListener('resize', () => {
    resizeCanvas(canvas);
  });

  document.addEventListener('visibilitychange', () => {
    lastTime = performance.now();
  });

  // --------------------------------------------------------------
  // State transitions
  // --------------------------------------------------------------

  let lastSettings: Settings | null = null;
  let lastAI: AIPlayer | null = null;

  function configureRenderer(renderer: GameRenderer, settings: Settings): void {
    renderer.musicEnabled = settings.musicEnabled;
    renderer.sfxEnabled = settings.sfxEnabled;
  }

  function handleRendererChrome(renderer: GameRenderer): void {
    if (renderer.wantsMusicToggle) {
      renderer.wantsMusicToggle = false;
      renderer.musicEnabled = !renderer.musicEnabled;
      setMusicEnabled(renderer.musicEnabled);
      if (lastSettings) lastSettings.musicEnabled = renderer.musicEnabled;
    }
    if (renderer.wantsSfxToggle) {
      renderer.wantsSfxToggle = false;
      renderer.sfxEnabled = !renderer.sfxEnabled;
      setSfxEnabled(renderer.sfxEnabled);
      if (lastSettings) lastSettings.sfxEnabled = renderer.sfxEnabled;
    }
    if (renderer.wantsMenu) {
      renderer.wantsMenu = false;
      returnToMenu();
    }
  }

  async function startGame(settings: Settings): Promise<void> {
    setMusicEnabled(settings.musicEnabled);
    setSfxEnabled(settings.sfxEnabled);

    if (settings.aiOpponent) {
      // AI mode
      setLoadingText('Loading AI...');
      const loadingEl = document.getElementById('loading')!;
      loadingEl.classList.remove('hidden');

      try {
        const ai = await AIPlayer.create(settings.aiOpponent as AIMode, settings.rows, settings.cols);
        hideLoading();

        const game = new Game(2, settings.rows, settings.cols);
        const renderer = new GameRenderer(canvas, game);
        renderer.playPop = playPop;
        configureRenderer(renderer, settings);
        renderer.useAIPalette();
        renderer.undoSteps = 2;
        appState = { kind: 'ai_game', renderer, settings, ai, aiTimer: 0 };
        lastSettings = settings;
        lastAI = ai;
      } catch (err) {
        showLoadingError('Failed to load AI model: ' + (err instanceof Error ? err.message : String(err)));
        return;
      }
    } else {
      // Human mode
      const game = new Game(settings.numPlayers, settings.rows, settings.cols);
      const renderer = new GameRenderer(canvas, game);
      renderer.playPop = playPop;
      configureRenderer(renderer, settings);
      appState = { kind: 'game', renderer, settings };
      lastSettings = settings;
    }
  }

  function returnToMenu(): void {
    if (appState.kind !== 'setup') {
      appState = { kind: 'setup', screen: new SetupScreen(canvas, getAudioSettings()) };
    }
  }

  function restartSameGame(): void {
    if (!lastSettings) return;
    if (lastSettings.aiOpponent && lastAI) {
      const game = new Game(2, lastSettings.rows, lastSettings.cols);
      const renderer = new GameRenderer(canvas, game);
      renderer.playPop = playPop;
      configureRenderer(renderer, lastSettings);
      renderer.useAIPalette();
      renderer.undoSteps = 2;
      appState = { kind: 'ai_game', renderer, settings: lastSettings, ai: lastAI, aiTimer: 0 };
    } else if (lastSettings) {
      const game = new Game(lastSettings.numPlayers, lastSettings.rows, lastSettings.cols);
      const renderer = new GameRenderer(canvas, game);
      renderer.playPop = playPop;
      configureRenderer(renderer, lastSettings);
      appState = { kind: 'game', renderer, settings: lastSettings };
    }
  }

  // --------------------------------------------------------------
  // rAF loop
  // --------------------------------------------------------------

  let lastTime = performance.now();

  function frame(now: number): void {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;

    if (appState.kind === 'setup') {
      appState.screen.draw();
    } else if (appState.kind === 'game') {
      const renderer = appState.renderer;
      renderer.update(dt);
      renderer.draw();
    } else if (appState.kind === 'ai_game') {
      const state = appState;
      const renderer = state.renderer;
      const game = renderer.game;

      renderer.update(dt);

      // AI move
      if (game.state === 'placing' && game.currentPlayer === 1) {
        // Kick off thinking as soon as turn starts (guarded inside startThink)
        state.ai.startThink(game, 1);
        state.aiTimer += dt;
        if (state.aiTimer >= AI_MOVE_DELAY && state.ai.hasMove()) {
          state.aiTimer = 0;
          const [r, c] = state.ai.takeMove();
          if (game.canPlace(r, c)) {
            game.place(r, c);
          }
          // Break TypeScript narrowing: place() may mutate state to 'animating'
          if ((game.state as string) === 'animating') {
            renderer.phaseTimer = 0;
          }
        }
      } else {
        state.aiTimer = 0;
      }

      renderer.draw();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  showLoadingError('Fatal error: ' + (err instanceof Error ? err.message : String(err)));
});
