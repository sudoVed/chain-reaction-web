import {
  PANEL_BG, PANEL_BG_HOVER, GOLD, GOLD_DIM, GOLD_HOVER, WHITE, WHITE_DIM, BLACK,
  GRID_OPTIONS, PLAYER_OPTIONS,
} from './constants';
import { RGB, canvasCssSize } from './utils';
import { drawGoldBtn, drawIconButton, drawPanel, drawSelectX } from './renderer';

export interface Settings {
  numPlayers: number;
  rows: number;
  cols: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  aiOpponent?: string;
}

export class SetupScreen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  w = 0; h = 0;
  selectedPlayers = 2;
  selectedGrid = 6;
  selectedGridForAI = 6;
  musicEnabled = true;
  sfxEnabled = true;

  fontTitle = 'bold 44px system-ui, sans-serif';
  fontLabel = '18px system-ui, sans-serif';
  fontBtn = 'bold 16px system-ui, sans-serif';
  fontStart = 'bold 20px system-ui, sans-serif';
  fontDesc = '13px system-ui, sans-serif';

  hovered: [string, number | string] | null = null;
  mode: 'setup' | 'model_select' = 'setup';
  selectedModel = 'smart';

  mousePos: [number, number] = [0, 0];
  musicBtnRect: [number, number, number, number] | null = null;
  soundBtnRect: [number, number, number, number] | null = null;

  static readonly BTN_W = 56;
  static readonly BTN_H = 44;
  static readonly GAP = 12;

  static readonly MODELS: [string, string, string][] = [
    ['defensive', 'Defensive', 'Safer moves'],
    ['greedy', 'Greedy', 'Fast captures'],
    ['smart', 'Trained', 'ONNX policy'],
  ];

  static readonly CARD_W = 170;
  static readonly CARD_H = 120;
  static readonly CIRCLE_R = 30;

  // Layout cache for hit testing
  private layout: {
    playersY: number;
    gridY: number;
    buttonsY: number;
    cardsY: number;
    cardGap: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, audioSettings?: { musicEnabled: boolean; sfxEnabled: boolean }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.w = canvas.width;
    this.h = canvas.height;
    if (audioSettings) {
      this.musicEnabled = audioSettings.musicEnabled;
      this.sfxEnabled = audioSettings.sfxEnabled;
    }
  }

  resize(): void {
    [this.w, this.h] = canvasCssSize(this.canvas);
    const compact = this.w < 520 || this.h < 620;
    this.fontTitle = compact ? 'bold 34px system-ui, sans-serif' : 'bold 44px system-ui, sans-serif';
    this.fontLabel = compact ? '16px system-ui, sans-serif' : '18px system-ui, sans-serif';
    this.fontBtn = compact ? 'bold 14px system-ui, sans-serif' : 'bold 16px system-ui, sans-serif';
    this.fontStart = compact ? 'bold 16px system-ui, sans-serif' : 'bold 20px system-ui, sans-serif';
  }

  handleMouseMove(pos: [number, number]): void {
    this.mousePos = pos;
    this.hovered = this._hitTest(pos);
  }

  handleClick(pos: [number, number]): Settings | null {
    const hit = this._hitTest(pos);
    if (!hit) return null;
    const [kind, val] = hit;

    if (this.mode === 'setup') {
      if (kind === 'players') {
        this.selectedPlayers = val as number;
      } else if (kind === 'grid') {
        this.selectedGrid = val as number;
        this.selectedGridForAI = val as number;
      } else if (kind === 'music') {
        this.musicEnabled = !this.musicEnabled;
      } else if (kind === 'sfx') {
        this.sfxEnabled = !this.sfxEnabled;
      } else if (kind === 'play') {
        return {
          numPlayers: this.selectedPlayers,
          rows: this.selectedGrid,
          cols: this.selectedGrid,
          musicEnabled: this.musicEnabled,
          sfxEnabled: this.sfxEnabled,
        };
      } else if (kind === 'play_with_model') {
        this.mode = 'model_select';
      }
    } else {
      if (kind === 'model') {
        this.selectedModel = val as string;
      } else if (kind === 'back') {
        this.mode = 'setup';
      } else if (kind === 'music') {
        this.musicEnabled = !this.musicEnabled;
      } else if (kind === 'sfx') {
        this.sfxEnabled = !this.sfxEnabled;
      } else if (kind === 'start_model') {
        return {
          numPlayers: 2,
          rows: this.selectedGridForAI,
          cols: this.selectedGridForAI,
          musicEnabled: this.musicEnabled,
          sfxEnabled: this.sfxEnabled,
          aiOpponent: this.selectedModel,
        };
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Layout: compute vertical positions centered on screen              */
  /* ---------------------------------------------------------------- */

  private _computeLayout() {
    const titleH = this.w < 520 || this.h < 620 ? 68 : 82;
    const btnH = this.w < 520 ? 46 : 50;
    const gap = this.h < 620 ? 22 : 34;
    const edgePad = this.w < 520 ? 16 : 30;

    if (this.mode === 'setup') {
      const playersPanelH = this._optionMetrics(PLAYER_OPTIONS.length).panelH;
      const gridPanelH = this._optionMetrics(GRID_OPTIONS.length).panelH;
      const totalH = titleH + gap + playersPanelH + gap + gridPanelH + gap + btnH;
      const startY = Math.max(edgePad, Math.floor((this.h - totalH) / 2));
      const playersY = startY + titleH + gap + 28;
      const gridY = playersY + playersPanelH + gap;
      this.layout = {
        playersY,
        gridY,
        buttonsY: gridY + gridPanelH + gap - 28,
        cardsY: 0,
        cardGap: 0,
      };
    } else {
      const subtitleH = 28;
      const cardRows = Math.ceil(SetupScreen.MODELS.length / this._modelColumnCount());
      const cardBlockH = cardRows * SetupScreen.CARD_H + (cardRows - 1) * 14;
      const totalH = titleH + subtitleH + gap + cardBlockH + gap + btnH;
      const startY = Math.max(edgePad, Math.floor((this.h - totalH) / 2));
      this.layout = {
        playersY: 0,
        gridY: 0,
        buttonsY: 0,
        cardsY: startY + titleH + subtitleH + gap + SetupScreen.CARD_H / 2,
        cardGap: 16,
      };
      this.layout.buttonsY = startY + titleH + subtitleH + gap + cardBlockH + gap;
    }
  }

  private _optionMetrics(count: number) {
    const btnW = this.w < 430 ? 46 : SetupScreen.BTN_W;
    const btnH = this.w < 430 ? 40 : SetupScreen.BTN_H;
    const gap = this.w < 430 ? 8 : SetupScreen.GAP;
    const maxW = Math.max(220, this.w - 32);
    const cols = Math.max(1, Math.min(count, Math.floor((maxW + gap) / (btnW + gap))));
    const rows = Math.ceil(count / cols);
    const totalW = cols * (btnW + gap) - gap;
    return {
      btnW,
      btnH,
      gap,
      cols,
      rows,
      totalW,
      panelW: totalW + 32,
      panelH: rows * btnH + (rows - 1) * gap + 42,
    };
  }

  private _optionRect(index: number, count: number, topY: number): [number, number, number, number] {
    const m = this._optionMetrics(count);
    const row = Math.floor(index / m.cols);
    const col = index % m.cols;
    const colsInRow = Math.min(m.cols, count - row * m.cols);
    const rowW = colsInRow * (m.btnW + m.gap) - m.gap;
    const sx = this.w / 2 - rowW / 2;
    return [sx + col * (m.btnW + m.gap), topY + 6 + row * (m.btnH + m.gap), m.btnW, m.btnH];
  }

  private _modelColumnCount(): number {
    if (this.w >= 650) return 3;
    if (this.w >= 430) return 2;
    return 1;
  }

  private _modelCardRect(index: number): [number, number, number, number] {
    const cols = this._modelColumnCount();
    const row = Math.floor(index / cols);
    const col = index % cols;
    const countInRow = Math.min(cols, SetupScreen.MODELS.length - row * cols);
    const gap = 14;
    const rowW = countInRow * SetupScreen.CARD_W + (countInRow - 1) * gap;
    const x = this.w / 2 - rowW / 2 + col * (SetupScreen.CARD_W + gap);
    const y = this.layout!.cardsY - SetupScreen.CARD_H / 2 + row * (SetupScreen.CARD_H + gap);
    return [x, y, SetupScreen.CARD_W, SetupScreen.CARD_H];
  }

  draw(): void {
    this.resize();
    this._computeLayout();
    const ctx = this.ctx;
    ctx.fillStyle = `rgb(13,14,15)`;
    ctx.fillRect(0, 0, this.w, this.h);

    this._drawTitle();
    this._drawTopRightAudio();
    if (this.mode === 'setup') {
      this._drawSection('Number of Players', PLAYER_OPTIONS, this.selectedPlayers, 'players', this.layout!.playersY);
      this._drawSection('Grid Size', GRID_OPTIONS, this.selectedGrid, 'grid', this.layout!.gridY);
      this._drawSetupButtons();
    } else {
      this._drawModelSelect();
    }
  }

  _drawTitle(): void {
    const ctx = this.ctx;
    const cx = this.w / 2;
    const startY = this.mode === 'setup'
      ? this.layout!.playersY - 24 - 70  // back-calculate from first element
      : this.layout!.cardsY - SetupScreen.CARD_H / 2 - (this.w < 520 ? 88 : 100);

    // Clamp title so it doesn't go off screen
    const titleY = Math.max(20, startY);

    ctx.font = this.fontTitle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillStyle = 'rgba(212,175,55,0.15)';
    ctx.fillText('Chain Reaction', cx, titleY + 3);
    ctx.fillStyle = `rgb(${GOLD[0]},${GOLD[1]},${GOLD[2]})`;
    ctx.fillText('Chain Reaction', cx, titleY);

  }

  _drawSection(label: string, options: readonly number[], selected: number, kind: string, topY: number): void {
    const ctx = this.ctx;
    const n = options.length;
    const m = this._optionMetrics(n);
    const panelW = m.panelW;
    const panelH = m.panelH;
    const panelX = this.w / 2 - panelW / 2;

    drawPanel(ctx, panelX, topY - 28, panelW, panelH, PANEL_BG, GOLD_DIM, 8, 1);

    ctx.font = this.fontLabel;
    ctx.fillStyle = `rgb(${WHITE_DIM[0]},${WHITE_DIM[1]},${WHITE_DIM[2]})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, this.w / 2, topY - 12);

    for (let i = 0; i < n; i++) {
      const opt = options[i];
      const [rectX, rectY, rectW, rectH] = this._optionRect(i, n, topY);
      const isSel = opt === selected;
      const isHov = this.hovered?.[0] === kind && this.hovered?.[1] === opt;

      let bg: RGB, border: RGB, tcol: RGB;
      if (isSel) {
        bg = GOLD;
        border = GOLD_HOVER;
        tcol = BLACK;
      } else if (isHov) {
        bg = PANEL_BG_HOVER;
        border = GOLD;
        tcol = GOLD_HOVER;
      } else {
        bg = PANEL_BG;
        border = GOLD_DIM;
        tcol = WHITE;
      }

      drawPanel(ctx, rectX, rectY, rectW, rectH, bg, border, 6, isSel ? 2 : 1);
      ctx.font = this.fontBtn;
      ctx.fillStyle = `rgb(${tcol[0]},${tcol[1]},${tcol[2]})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(opt), rectX + rectW / 2, rectY + rectH / 2);
    }
  }

  _drawSetupButtons(): void {
    const ctx = this.ctx;
    const btnGap = this.w < 430 ? 10 : 16;
    const btnW = Math.min(178, Math.floor((this.w - 44) / 2));
    const btnH = this.w < 520 ? 46 : 50;
    const totalW = btnW * 2 + btnGap;
    const bx = this.w / 2 - totalW / 2;
    const by = this.layout!.buttonsY;

    const leftHovered = this.hovered?.[0] === 'play_with_model';
    const rightHovered = this.hovered?.[0] === 'play';

    drawGoldBtn(ctx, bx, by, btnW, btnH, 'Play with Model', this.fontBtn, false, leftHovered);
    drawGoldBtn(ctx, bx + btnW + btnGap, by, btnW, btnH, 'Play', this.fontStart, true, rightHovered);
  }

  _drawTopRightAudio(): void {
    const ctx = this.ctx;
    const size = this.w < 520 ? 30 : 34;
    const gap = 8;
    const y = this.w < 520 ? 14 : 18;
    const soundX = this.w - 14 - size;
    const musicX = soundX - gap - size;
    this.musicBtnRect = [musicX, y, size, size];
    this.soundBtnRect = [soundX, y, size, size];
    drawIconButton(ctx, musicX, y, size, 'music', this.musicEnabled, this.hovered?.[0] === 'music');
    drawIconButton(ctx, soundX, y, size, 'sound', this.sfxEnabled, this.hovered?.[0] === 'sfx');
  }

  _drawModelSelect(): void {
    const ctx = this.ctx;
    const subtitleY = this.layout!.cardsY - SetupScreen.CARD_H / 2 - 28;

    ctx.font = this.fontLabel;
    ctx.fillStyle = `rgb(${WHITE_DIM[0]},${WHITE_DIM[1]},${WHITE_DIM[2]})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Choose Your Opponent', this.w / 2, subtitleY);

    for (let i = 0; i < SetupScreen.MODELS.length; i++) {
      const [key, label, desc] = SetupScreen.MODELS[i];
      this._drawModelCard(i, label, desc, this.selectedModel === key);
    }

    const btnGap = this.w < 430 ? 10 : 16;
    const btnW = Math.min(160, Math.floor((this.w - 60) / 2));
    const btnH = this.w < 520 ? 46 : 50;
    const totalW = btnW * 2 + btnGap;
    const bx = this.w / 2 - totalW / 2;
    const by = this.layout!.buttonsY;

    drawGoldBtn(ctx, bx, by, btnW, btnH, 'Back', this.fontStart, false, this.hovered?.[0] === 'back');
    drawGoldBtn(ctx, bx + btnW + btnGap, by, btnW, btnH, 'Start', this.fontStart, true, this.hovered?.[0] === 'start_model');
  }

  _drawModelCard(index: number, label: string, desc: string, selected: boolean): void {
    const ctx = this.ctx;
    const [rectX, rectY, cw, ch] = this._modelCardRect(index);
    const cx = rectX + cw / 2;
    const cy = rectY + ch / 2;

    const bg = selected ? [25, 22, 12] as RGB : PANEL_BG;
    const border = selected ? GOLD : GOLD_DIM;
    drawPanel(ctx, rectX, rectY, cw, ch, bg, border, 10, selected ? 2 : 1);

    const circleCy = cy - 14;
    const r = SetupScreen.CIRCLE_R;
    const circleCol = selected ? GOLD : GOLD_DIM;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, circleCy, r, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgb(${circleCol[0]},${circleCol[1]},${circleCol[2]})`;
    ctx.stroke();
    ctx.restore();

    if (selected) {
      drawSelectX(ctx, cx, circleCy, r, GOLD);
    }

    const lcol = selected ? GOLD : WHITE;
    ctx.font = this.fontLabel;
    ctx.fillStyle = `rgb(${lcol[0]},${lcol[1]},${lcol[2]})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + ch / 2 - 30);

    ctx.font = this.fontDesc;
    ctx.fillStyle = `rgb(${WHITE_DIM[0]},${WHITE_DIM[1]},${WHITE_DIM[2]})`;
    ctx.fillText(desc, cx, cy + ch / 2 - 10);
  }

  _hitTest(pos: [number, number]): [string, number | string] | null {
    const [x, y] = pos;
    const w = this.w;

    if (!this.layout) this._computeLayout();
    const ly = this.layout!;

    if (this.musicBtnRect) {
      const [rx, ry, rw, rh] = this.musicBtnRect;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        return ['music', 0];
      }
    }
    if (this.soundBtnRect) {
      const [rx, ry, rw, rh] = this.soundBtnRect;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        return ['sfx', 0];
      }
    }

    if (this.mode === 'setup') {
      // Players section
      let topY = ly.playersY;
      for (let i = 0; i < PLAYER_OPTIONS.length; i++) {
        const [rx, ry, rw, rh] = this._optionRect(i, PLAYER_OPTIONS.length, topY);
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          return ['players', PLAYER_OPTIONS[i]];
        }
      }

      // Grid section
      topY = ly.gridY;
      for (let i = 0; i < GRID_OPTIONS.length; i++) {
        const [rx, ry, rw, rh] = this._optionRect(i, GRID_OPTIONS.length, topY);
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          return ['grid', GRID_OPTIONS[i]];
        }
      }

      // Buttons
      const btnGap = w < 430 ? 10 : 16;
      const btnW = Math.min(180, Math.floor((w - 60) / 2));
      const btnH = w < 520 ? 46 : 50;
      const totalBtnW = btnW * 2 + btnGap;
      const bx = w / 2 - totalBtnW / 2;
      const by = ly.buttonsY;
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
        return ['play_with_model', 0];
      }
      if (x >= bx + btnW + btnGap && x <= bx + btnW + btnGap + btnW && y >= by && y <= by + btnH) {
        return ['play', 0];
      }
    } else {
      // Model cards
      for (let i = 0; i < SetupScreen.MODELS.length; i++) {
        const [rx, ry, rw, rh] = this._modelCardRect(i);
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          return ['model', SetupScreen.MODELS[i][0]];
        }
      }

      // Buttons
      const btnGap = w < 430 ? 10 : 16;
      const btnW = Math.min(160, Math.floor((w - 60) / 2));
      const btnH = w < 520 ? 46 : 50;
      const totalBtnW = btnW * 2 + btnGap;
      const bx = w / 2 - totalBtnW / 2;
      const by = ly.buttonsY;
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
        return ['back', 0];
      }
      if (x >= bx + btnW + btnGap && x <= bx + btnW + btnGap + btnW && y >= by && y <= by + btnH) {
        return ['start_model', 0];
      }
    }

    return null;
  }
}
