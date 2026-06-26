import { Game } from './game';
import {
  PLAYER_COLORS, UI_HEIGHT, ORB_RADIUS_RATIO,
  BURST_DURATION_MS, FLY_DURATION_MS, EXPLODE_DELAY_MS, SPIN_SPEED,
  BG, PANEL_BG, PANEL_BG_HOVER, GOLD, GOLD_DIM, GOLD_HOVER, WHITE, WHITE_DIM, BLACK,
  GRID_LINE,
} from './constants';
import { RGB, canvasCssSize, lerpColorArr, smoothstep, orbPositions } from './utils';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function drawOrb(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  baseCol: RGB, rimCol: RGB, alpha = 255
): void {
  r = Math.max(r, 3);
  ctx.save();
  ctx.globalAlpha = alpha / 255;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${rimCol[0]},${rimCol[1]},${rimCol[2]})`;
  ctx.fill();

  const baseR = Math.max(1, Math.floor(r * 0.82));
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${baseCol[0]},${baseCol[1]},${baseCol[2]})`;
  ctx.fill();

  const shineR = Math.max(1, Math.floor(r * 0.35));
  const shineCol = lerpColorArr(baseCol, [255, 255, 255], 0.7);
  const sx = Math.floor(cx - r * 0.28 * 0.8);
  const sy = Math.floor(cy - r * 0.28);
  ctx.beginPath();
  ctx.arc(sx, sy, shineR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${shineCol[0]},${shineCol[1]},${shineCol[2]},0.63)`;
  ctx.fill();

  ctx.restore();
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  bg: RGB, border: RGB, radius = 10, borderW = 1
): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
  ctx.fill();
  if (borderW > 0) {
    ctx.lineWidth = borderW;
    ctx.strokeStyle = `rgb(${border[0]},${border[1]},${border[2]})`;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGoldBtn(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, font: string,
  primary = false, hovered = false, disabled = false
): void {
  let bg: RGB, border: RGB, tcol: RGB;
  if (disabled) {
    bg = [20, 20, 20]; border = [60, 60, 60]; tcol = [80, 80, 80];
  } else if (primary) {
    bg = hovered ? GOLD : [30, 25, 10];
    border = hovered ? GOLD_HOVER : GOLD;
    tcol = hovered ? BLACK : GOLD;
  } else {
    bg = hovered ? PANEL_BG_HOVER : PANEL_BG;
    border = hovered ? GOLD : GOLD_DIM;
    tcol = hovered ? GOLD_HOVER : WHITE;
  }

  drawPanel(ctx, x, y, w, h, bg, border, 8, 1);
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = `rgb(${tcol[0]},${tcol[1]},${tcol[2]})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
}

function drawSelectX(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, col: RGB
): void {
  const ext = Math.floor(r * 0.9);
  const w = Math.max(10, Math.floor(r * 0.30));

  ctx.save();
  ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(cx - ext * 0.7, cy - ext * 0.7);
  ctx.lineTo(cx + ext * 0.7, cy + ext * 0.7);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + ext * 0.7, cy - ext * 0.7);
  ctx.lineTo(cx - ext * 0.7, cy + ext * 0.7);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  ctx.stroke();
  ctx.restore();
}

function drawIconButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  icon: 'music' | 'sound' | 'exit',
  active = true,
  hovered = false
): void {
  const border = hovered ? GOLD : [55, 52, 43] as RGB;
  const col = hovered || active ? GOLD : WHITE;
  const inactiveCol = hovered ? GOLD : WHITE_DIM;
  drawPanel(ctx, x, y, size, size, PANEL_BG, border, 8, 1);

  ctx.save();
  const iconCol = active ? col : inactiveCol;
  ctx.strokeStyle = `rgb(${iconCol[0]},${iconCol[1]},${iconCol[2]})`;
  ctx.fillStyle = `rgb(${iconCol[0]},${iconCol[1]},${iconCol[2]})`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const iconSize = Math.round(size * 0.54);
  const pad = (size - iconSize) / 2;
  const scale = iconSize / 24;
  const drawPath = (d: string, fill = false): void => {
    const path = new Path2D(d);
    ctx.save();
    ctx.translate(x + pad, y + pad);
    ctx.scale(scale, scale);
    if (fill) ctx.fill(path);
    else ctx.stroke(path);
    ctx.restore();
  };

  if (icon === 'music') {
    drawPath('M9 18V5l12-2v13');
    drawPath('M6 15a3 3 0 1 0 0.1 0', true);
    drawPath('M18 13a3 3 0 1 0 0.1 0', true);
    if (!active) drawPath('M3 3l18 18');
  } else if (icon === 'sound') {
    drawPath('M11 5 6 9H2v6h4l5 4z');
    if (active) {
      drawPath('M15.5 8.5a5 5 0 0 1 0 7');
      drawPath('M19 5a9 9 0 0 1 0 14');
    } else {
      drawPath('M23 9l-6 6');
      drawPath('M17 9l6 6');
    }
  } else {
    drawPath('M16 17l5-5-5-5');
    drawPath('M21 12H9');
    drawPath('M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3');
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Flying orb                                                         */
/* ------------------------------------------------------------------ */

interface FlyingOrb {
  sx: number; sy: number;
  dx: number; dy: number;
  owner: number;
}

function flyingOrbPos(orb: FlyingOrb, t: number): [number, number] {
  const s = smoothstep(t);
  return [
    orb.sx + (orb.dx - orb.sx) * s,
    orb.sy + (orb.dy - orb.sy) * s,
  ];
}

/* ------------------------------------------------------------------ */
/* Sparkle background                                                   */
/* ------------------------------------------------------------------ */

interface Sparkle {
  x: number; y: number;
  bornMs: number; durationMs: number;
  size: number;
}

/* ------------------------------------------------------------------ */
/* Game renderer                                                        */
/* ------------------------------------------------------------------ */

export class GameRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  game: Game;

  w = 0; h = 0;
  cs = 1;
  ox = 0; oy = 0;

  fontUI = 'bold 15px system-ui, sans-serif';
  fontWin = 'bold 52px system-ui, sans-serif';
  fontSub = '20px system-ui, sans-serif';

  spinAngle = 0.0;

  phase: 'idle' | 'burst' | 'flying' = 'idle';
  phaseTimer = 0;

  currentWave: [number, number][] = [];
  waveOwners = new Map<string, number>();
  hiding = new Set<string>();
  flyingOrbs: FlyingOrb[] = [];

  hover: [number, number] | null = null;
  mousePos: [number, number] = [0, 0];

  undoBtnRect: [number, number, number, number] | null = null;
  exitBtnRect: [number, number, number, number] | null = null;
  musicBtnRect: [number, number, number, number] | null = null;
  soundBtnRect: [number, number, number, number] | null = null;
  wantsMenu = false;
  wantsMusicToggle = false;
  wantsSfxToggle = false;

  sparkles: Sparkle[] = [];
  totalMs = 0;
  sparkleAccum = 0;
  sparkleInterval = 340;

  playPop: (() => void) | null = null;
  undoSteps = 1;
  musicEnabled = true;
  sfxEnabled = true;
  aiOpponent = false;
  private playerColors = [...PLAYER_COLORS];

  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.game = game;
    this.w = canvas.width;
    this.h = canvas.height;
    this._layout();
  }

  useAIPalette(): void {
    this.aiOpponent = true;
    this.playerColors = [
      { name: 'Gold', base: GOLD, rim: [132, 100, 18], trail: [255, 226, 122] },
      { name: 'White', base: [236, 232, 220], rim: [150, 148, 140], trail: [255, 252, 240] },
    ];
  }

  /* ---------------------------------------------------------------- */
  /* Layout                                                           */
  /* ---------------------------------------------------------------- */

  _layout(): void {
    [this.w, this.h] = canvasCssSize(this.canvas);
    const edgePad = this.w < 520 ? 12 : 24;
    const topPad = this.h < 520 ? 12 : 20;
    const availW = this.w - edgePad * 2;
    const availH = this.h - UI_HEIGHT - topPad - edgePad;
    const maxCell = this.w < 520 ? Math.floor(availW / this.game.cols) : 82;
    const cs = Math.min(
      Math.floor(availW / this.game.cols),
      Math.floor(availH / this.game.rows),
      maxCell
    );
    this.cs = Math.max(cs, 14);
    this.ox = Math.floor((this.w - this.cs * this.game.cols) / 2);
    const contentTop = UI_HEIGHT + topPad;
    const spareH = Math.max(0, this.h - contentTop - this.cs * this.game.rows - edgePad);
    this.oy = contentTop + Math.floor(spareH * 0.5);
  }

  /* ---------------------------------------------------------------- */
  /* Cell helpers                                                     */
  /* ---------------------------------------------------------------- */

  _cellCenter(r: number, c: number): [number, number] {
    return [
      this.ox + c * this.cs + this.cs / 2,
      this.oy + r * this.cs + this.cs / 2,
    ];
  }

  _cellAt(pos: [number, number]): [number, number] | null {
    const [x, y] = pos;
    if (this.cs < 1) return null;
    const c = Math.floor((x - this.ox) / this.cs);
    const r = Math.floor((y - this.oy) / this.cs);
    if (0 <= r && r < this.game.rows && 0 <= c && c < this.game.cols) {
      return [r, c];
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Update                                                           */
  /* ---------------------------------------------------------------- */

  update(dtMs: number): void {
    this.spinAngle = (this.spinAngle + SPIN_SPEED) % 360;
    this._tickSparkles(dtMs);

    if (this.game.state !== 'animating') return;
    this.phaseTimer += dtMs;

    if (this.phase === 'idle') {
      if (this.phaseTimer >= EXPLODE_DELAY_MS) {
        this.phaseTimer = 0;
        const wave = this.game.getWave();
        if (wave.length > 0) this._beginBurst(wave);
      }
    } else if (this.phase === 'burst') {
      if (this.phaseTimer >= BURST_DURATION_MS) {
        this.phaseTimer = 0;
        this._beginFlying();
      }
    } else if (this.phase === 'flying') {
      if (this.phaseTimer >= FLY_DURATION_MS) {
        this.phaseTimer = 0;
        this._finishWave();
      }
    }
  }

  _beginBurst(wave: [number, number][]): void {
    const committed = this.game.committedExplosions;
    this.currentWave = wave.filter(([r, c]) => {
      const cm = this.game.criticalMass(r, c);
      return this.game.grid[r][c].count >= cm || committed.has(`${r},${c}`);
    });
    if (this.currentWave.length === 0) {
      this.game.applyWave(wave);
      this.phase = 'idle';
      return;
    }
    this.waveOwners.clear();
    for (const [r, c] of this.currentWave) {
      this.waveOwners.set(`${r},${c}`, this.game.grid[r][c].owner);
    }
    this.hiding.clear();
    for (const [r, c] of this.currentWave) this.hiding.add(`${r},${c}`);
    this.phase = 'burst';
    if (this.playPop) this.playPop();
  }

  _beginFlying(): void {
    this.flyingOrbs = [];
    for (const [r, c] of this.currentWave) {
      const owner = this.waveOwners.get(`${r},${c}`) ?? -1;
      if (owner < 0) continue;
      const [sx, sy] = this._cellCenter(r, c);
      for (const [nr, nc] of this.game.neighbours(r, c)) {
        const [dx, dy] = this._cellCenter(nr, nc);
        this.flyingOrbs.push({ sx, sy, dx, dy, owner });
      }
    }
    this.phase = 'flying';
  }

  _finishWave(): void {
    this.game.applyWave(this.currentWave);
    this.currentWave = [];
    this.waveOwners.clear();
    this.hiding.clear();
    this.flyingOrbs = [];
    this.phase = 'idle';
    this.phaseTimer = 0;
  }

  /* ---------------------------------------------------------------- */
  /* Sparkles                                                         */
  /* ---------------------------------------------------------------- */

  _tickSparkles(dtMs: number): void {
    this.totalMs += dtMs;
    this.sparkles = this.sparkles.filter(s => this.totalMs - s.bornMs < s.durationMs);
    this.sparkleAccum += dtMs;
    while (this.sparkleAccum >= this.sparkleInterval) {
      this.sparkleAccum -= this.sparkleInterval;
      this._trySpawnSparkle();
    }
  }

  _trySpawnSparkle(): void {
    const gridL = this.ox;
    const gridR = this.ox + this.game.cols * this.cs;
    const gridT = this.oy;
    const gridB = this.oy + this.game.rows * this.cs;
    const margin = 6;
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(Math.random() * (this.w - margin * 2)) + margin;
      const y = Math.floor(Math.random() * (this.h - UI_HEIGHT - margin * 2)) + UI_HEIGHT + margin;
      if (!(gridL <= x && x <= gridR && gridT <= y && y <= gridB)) {
        const dur = Math.floor(Math.random() * 400) + 700;
        const size = Math.random() * 3.5 + 2.0;
        this.sparkles.push({ x, y, bornMs: this.totalMs, durationMs: dur, size });
        this.sparkleInterval = Math.floor(Math.random() * 180) + 260;
        return;
      }
    }
  }

  _drawSparkles(): void {
    for (const s of this.sparkles) {
      const age = this.totalMs - s.bornMs;
      const t = Math.max(0, Math.min(1, age / s.durationMs));
      let alpha: number;
      if (t < 0.25) alpha = t / 0.25;
      else if (t > 0.65) alpha = 1.0 - (t - 0.65) / 0.35;
      else alpha = 1.0;
      const a = Math.max(0, Math.min(1, alpha)) * 180;
      if (a < 4) continue;

      const arm = Math.floor(s.size * 2.6);
      const darm = Math.floor(s.size * 1.3);
      const pad = arm + 2;
      const scx = pad, scy = pad;
      const col = `rgba(212,175,55,${a / 255})`;
      const lw = Math.max(1, Math.floor(s.size * 0.45));

      this.ctx.save();
      this.ctx.translate(s.x - pad, s.y - pad);
      this.ctx.strokeStyle = col;
      this.ctx.lineWidth = lw;
      this.ctx.lineCap = 'round';

      this.ctx.beginPath(); this.ctx.moveTo(scx, scy - arm); this.ctx.lineTo(scx, scy + arm); this.ctx.stroke();
      this.ctx.beginPath(); this.ctx.moveTo(scx - arm, scy); this.ctx.lineTo(scx + arm, scy); this.ctx.stroke();
      this.ctx.beginPath(); this.ctx.moveTo(scx - darm, scy - darm); this.ctx.lineTo(scx + darm, scy + darm); this.ctx.stroke();
      this.ctx.beginPath(); this.ctx.moveTo(scx + darm, scy - darm); this.ctx.lineTo(scx - darm, scy + darm); this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(scx, scy, Math.max(1, Math.floor(s.size * 0.5)), 0, Math.PI * 2);
      this.ctx.fillStyle = col;
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Events                                                           */
  /* ---------------------------------------------------------------- */

  handleMouseMove(pos: [number, number]): void {
    this.mousePos = pos;
    this.hover = this._cellAt(pos);
  }

  handleClick(pos: [number, number], allowBoard = true): void {
    const [x, y] = pos;

    if (this.exitBtnRect) {
      const [mx, my, mw, mh] = this.exitBtnRect;
      if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
        this.wantsMenu = true;
        return;
      }
    }
    if (this.musicBtnRect) {
      const [mx, my, mw, mh] = this.musicBtnRect;
      if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
        this.wantsMusicToggle = true;
        return;
      }
    }
    if (this.soundBtnRect) {
      const [mx, my, mw, mh] = this.soundBtnRect;
      if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
        this.wantsSfxToggle = true;
        return;
      }
    }

    if (this.undoBtnRect) {
      const [ux, uy, uw, uh] = this.undoBtnRect;
      if (x >= ux && x <= ux + uw && y >= uy && y <= uy + uh) {
        if (this._canUndo()) this._tryUndo();
        return;
      }
    }

    if (!allowBoard) return;

    const cell = this._cellAt(pos);
    if (cell) {
      const placed = this.game.place(cell[0], cell[1]);
      if (placed && this.game.state === 'animating') {
        this.phaseTimer = 0;
      }
    }
  }

  handleKey(key: string): void {
    if ((key === 'z' || key === 'u') && this._canUndo()) this._tryUndo();
  }

  _canUndo(): boolean {
    return this.game.state === 'placing'
      && this.game.history.length > 0
      && (!this.aiOpponent || this.game.currentPlayer === 0);
  }

  _tryUndo(): void {
    if (!this._canUndo()) return;
    if (this.game.undo()) {
      for (let i = 1; i < this.undoSteps && this.game.history.length > 0; i++) {
        this.game.undo();
      }
      this._resetAnimation();
    }
  }

  _resetAnimation(): void {
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.currentWave = [];
    this.waveOwners.clear();
    this.hiding.clear();
    this.flyingOrbs = [];
  }

  /* ---------------------------------------------------------------- */
  /* Draw                                                             */
  /* ---------------------------------------------------------------- */

  draw(): void {
    this._layout();
    const ctx = this.ctx;
    ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
    ctx.fillRect(0, 0, this.w, this.h);

    this._drawSparkles();
    this._drawUIBar();
    this._drawGrid();
    this._drawCells();
    this._drawFlyingOrbs();
    if (this.phase === 'burst') this._drawBursts();
    if (this.game.state === 'won') this._drawWinScreen();
  }

  _drawUIBar(): void {
    const g = this.game;
    const ctx = this.ctx;

    // Top bar background
    ctx.fillStyle = 'rgb(19,20,21)';
    ctx.fillRect(0, 0, this.w, UI_HEIGHT);
    ctx.strokeStyle = `rgb(${GOLD_DIM[0]},${GOLD_DIM[1]},${GOLD_DIM[2]})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, UI_HEIGHT - 0.5);
    ctx.lineTo(this.w, UI_HEIGHT - 0.5);
    ctx.stroke();

    const [mx, my] = this.mousePos;
    const iconSize = this.w < 520 ? 30 : 34;
    const iconGap = this.w < 520 ? 6 : 8;
    const iconY = Math.floor((UI_HEIGHT - iconSize) / 2);
    const exitX = this.w - 10 - iconSize;
    const soundX = exitX - iconGap - iconSize;
    const musicX = soundX - iconGap - iconSize;
    this.musicBtnRect = [musicX, iconY, iconSize, iconSize];
    this.soundBtnRect = [soundX, iconY, iconSize, iconSize];
    this.exitBtnRect = [exitX, iconY, iconSize, iconSize];

    drawIconButton(ctx, musicX, iconY, iconSize, 'music', this.musicEnabled, mx >= musicX && mx <= musicX + iconSize && my >= iconY && my <= iconY + iconSize);
    drawIconButton(ctx, soundX, iconY, iconSize, 'sound', this.sfxEnabled, mx >= soundX && mx <= soundX + iconSize && my >= iconY && my <= iconY + iconSize);
    drawIconButton(ctx, exitX, iconY, iconSize, 'exit', true, mx >= exitX && mx <= exitX + iconSize && my >= iconY && my <= iconY + iconSize);

    const compact = this.w < 560;
    const bw = compact ? 70 : 92, bh = 32;
    const btnX = this.w / 2 - bw / 2;
    const btnY = UI_HEIGHT / 2 - bh / 2;
    this.undoBtnRect = [btnX, btnY, bw, bh];

    // Current player indicator
    if (g.state === 'placing' || g.state === 'animating') {
      const col = this.playerColors[g.currentPlayer].base;
      const name = this.playerColors[g.currentPlayer].name;
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fillRect(0, 0, 4, UI_HEIGHT);
      ctx.beginPath();
      ctx.arc(21, UI_HEIGHT / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgb(240,240,240)';
      ctx.font = this.fontUI;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const turnText = name + "'s turn";
      const textX = 48;
      const maxTextW = Math.max(62, Math.min(btnX - textX - 10, musicX - textX - 10));
      const displayText = ctx.measureText(turnText).width > maxTextW ? name : turnText;
      ctx.fillText(displayText, textX, UI_HEIGHT / 2, maxTextW);
    }

    // Undo button
    const canUndo = this._canUndo();
    const uHovered = mx >= btnX && mx <= btnX + bw && my >= btnY && my <= btnY + bh;
    drawGoldBtn(ctx, btnX, btnY, bw, bh, 'Undo', this.fontUI, false, uHovered && canUndo, !canUndo);
  }

  _drawGrid(): void {
    const ctx = this.ctx;
    const cs = this.cs, ox = this.ox, oy = this.oy;
    const g = this.game;

    // Corner highlights
    const corners: [number, number][] = [
      [0, 0], [0, g.cols - 1], [g.rows - 1, 0], [g.rows - 1, g.cols - 1]
    ];
    for (const [r, c] of corners) {
      ctx.fillStyle = 'rgba(212,175,55,0.04)';
      ctx.fillRect(ox + c * cs + 1, oy + r * cs + 1, cs - 1, cs - 1);
    }

    // Grid lines
    ctx.strokeStyle = `rgb(${GRID_LINE[0]},${GRID_LINE[1]},${GRID_LINE[2]})`;
    ctx.lineWidth = 1;
    for (let r = 0; r <= g.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cs);
      ctx.lineTo(ox + g.cols * cs, oy + r * cs);
      ctx.stroke();
    }
    for (let c = 0; c <= g.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cs, oy);
      ctx.lineTo(ox + c * cs, oy + g.rows * cs);
      ctx.stroke();
    }

    // Hover highlight
    if (this.hover && g.state === 'placing') {
      const [r, c] = this.hover;
      if (g.canPlace(r, c)) {
        const pcol = this.playerColors[g.currentPlayer].base;
        ctx.fillStyle = `rgba(${pcol[0]},${pcol[1]},${pcol[2]},0.18)`;
        ctx.fillRect(ox + c * cs + 1, oy + r * cs + 1, cs - 1, cs - 1);
      }
    }
  }

  _drawCells(): void {
    for (let r = 0; r < this.game.rows; r++) {
      for (let c = 0; c < this.game.cols; c++) {
        if (this.hiding.has(`${r},${c}`)) continue;
        const cell = this.game.grid[r][c];
        if (cell.owner < 0 || cell.count === 0) continue;
        this._drawCellOrbs(r, c, cell);
      }
    }
  }

  _drawCellOrbs(r: number, c: number, cell: { owner: number; count: number }): void {
    const [cx, cy] = this._cellCenter(r, c);
    const orbR = this.cs * ORB_RADIUS_RATIO;
    const primed = this.game.isPrimed(r, c);
    const angle = primed ? this.spinAngle : 0.0;
    const pcol = this.playerColors[cell.owner];
    const positions = orbPositions(cell.count, cx, cy, orbR, angle);
    for (const [px, py] of positions) {
      drawOrb(this.ctx, px, py, orbR, pcol.base as RGB, pcol.rim as RGB);
    }
  }

  _drawBursts(): void {
    const t = this.phaseTimer / BURST_DURATION_MS;
    for (const [r, c] of this.currentWave) {
      this._drawOneBurst(r, c, t);
    }
  }

  _drawOneBurst(r: number, c: number, t: number): void {
    const [cx, cy] = this._cellCenter(r, c);
    const cs = this.cs;
    const owner = this.waveOwners.get(`${r},${c}`) ?? -1;
    const col = owner >= 0 ? this.playerColors[owner].trail : [255, 255, 255];

    const ringR = Math.floor(cs * 0.25 + cs * 0.35 * t);
    const alpha = Math.floor(255 * (1 - t));
    if (ringR > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha / 255})`;
      this.ctx.stroke();
      this.ctx.restore();
    }

    const flashR = Math.floor(cs * 0.30 * (1 - t));
    if (flashR > 1) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, flashR, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255,255,255,${(220 * (1 - t)) / 255})`;
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  _drawFlyingOrbs(): void {
    if (this.phase !== 'flying' || this.flyingOrbs.length === 0) return;
    const t = this.phaseTimer / FLY_DURATION_MS;
    const orbR = this.cs * ORB_RADIUS_RATIO * 0.85;
    for (const orb of this.flyingOrbs) {
      const [px, py] = flyingOrbPos(orb, t);
      const pcol = this.playerColors[orb.owner];
      drawOrb(this.ctx, px, py, orbR, pcol.base as RGB, pcol.rim as RGB);
    }
  }

  _drawWinScreen(): void {
    const ctx = this.ctx;
    const w = this.w, h = this.h;

    ctx.fillStyle = 'rgba(13,14,15,0.88)';
    ctx.fillRect(0, 0, w, h);

    const p = this.game.winner;
    const col = this.playerColors[p].base;
    const name = this.playerColors[p].name;

    const pw = Math.min(520, w - 40);
    const ph = Math.min(200, h - 40);
    const px = w / 2 - pw / 2;
    const py = h / 2 - ph / 2;

    drawPanel(ctx, px, py, pw, ph, [22, 23, 24], col, 8, 2);

    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.font = this.fontWin;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const winText = this.aiOpponent ? (p === 0 ? 'You win!' : 'You lose...') : name + ' wins!';
    ctx.fillText(winText, w / 2, h / 2 - 24);

    ctx.fillStyle = 'rgb(160,160,160)';
    ctx.font = this.fontSub;
    ctx.fillText('R - play again', w / 2, h / 2 + 38);
    ctx.fillStyle = 'rgb(120,120,120)';
    ctx.fillText('Esc - quit', w / 2, h / 2 + 68);
  }
}

export { drawGoldBtn, drawIconButton, drawPanel, drawSelectX };
