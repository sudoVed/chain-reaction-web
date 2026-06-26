// game.ts — Pure game logic, zero rendering/audio imports.
// 1:1 port of game.py. Used headless by AI training and the renderer.

const DIRECTIONS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export interface Snapshot {
  grid: [number, number][]; // flat list of (owner, count)
  currentPlayer: number;
  turnNumber: number;
  firstTurnDone: number[];
  alive: number[];
  state: string;
  winner: number;
}

export class Cell {
  owner: number; // -1 = empty, 0..N-1 = player
  count: number;

  constructor() {
    this.owner = -1;
    this.count = 0;
  }

  isEmpty(): boolean {
    return this.owner === -1;
  }
}

export class Game {
  numPlayers: number;
  rows: number;
  cols: number;

  grid: Cell[][];

  currentPlayer: number;
  turnNumber: number;
  firstTurnDone: boolean[];
  alive: boolean[];

  explosionQueue: [number, number][];
  committedExplosions: Set<string>;

  state: string; // "placing" | "animating" | "won"
  winner: number;

  history: Snapshot[];

  constructor(numPlayers: number, rows: number, cols: number) {
    this.numPlayers = numPlayers;
    this.rows = rows;
    this.cols = cols;

    this.grid = [];
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(new Cell());
      }
      this.grid.push(row);
    }

    this.currentPlayer = 0;
    this.turnNumber = 0;
    this.firstTurnDone = new Array(numPlayers).fill(false);
    this.alive = new Array(numPlayers).fill(true);

    this.explosionQueue = [];
    this.committedExplosions = new Set();

    this.state = "placing";
    this.winner = -1;

    this.history = [];
  }

  // ------------------------------------------------------------------
  // Geometry
  // ------------------------------------------------------------------

  inBounds(r: number, c: number): boolean {
    return 0 <= r && r < this.rows && 0 <= c && c < this.cols;
  }

  neighbours(r: number, c: number): [number, number][] {
    const result: [number, number][] = [];
    for (const [dr, dc] of DIRECTIONS) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.inBounds(nr, nc)) {
        result.push([nr, nc]);
      }
    }
    return result;
  }

  criticalMass(r: number, c: number): number {
    return this.neighbours(r, c).length;
  }

  isPrimed(r: number, c: number): boolean {
    const cell = this.grid[r][c];
    return !cell.isEmpty() && cell.count === this.criticalMass(r, c) - 1;
  }

  isOverloaded(r: number, c: number): boolean {
    return this.grid[r][c].count >= this.criticalMass(r, c);
  }

  // ------------------------------------------------------------------
  // Placement
  // ------------------------------------------------------------------

  canPlace(r: number, c: number): boolean {
    if (this.state !== "placing") return false;
    const cell = this.grid[r][c];
    return cell.isEmpty() || cell.owner === this.currentPlayer;
  }

  place(r: number, c: number): boolean {
    if (!this.canPlace(r, c)) return false;

    this.history.push(this._snapshot());

    const cell = this.grid[r][c];
    cell.owner = this.currentPlayer;
    cell.count += 1;
    this.firstTurnDone[this.currentPlayer] = true;
    this.turnNumber += 1;

    if (this.isOverloaded(r, c)) {
      this.state = "animating";
      this.explosionQueue.push([r, c]);
    } else {
      this._endTurn();
    }
    return true;
  }

  // ------------------------------------------------------------------
  // Wave-based cascade
  // ------------------------------------------------------------------

  getWave(): [number, number][] {
    const wave = [...this.explosionQueue];
    this.explosionQueue = [];
    return wave;
  }

  applyWave(wave: [number, number][]): void {
    // --- Step 1: scatter ---
    const outgoing: [number, number, number][] = []; // [nr, nc, owner]

    for (const [r, c] of wave) {
      const cell = this.grid[r][c];
      const cm = this.criticalMass(r, c);
      const owner = cell.owner;
      const key = `${r},${c}`;

      if (this.committedExplosions.has(key)) {
        this.committedExplosions.delete(key);
        if (cell.count === 0) {
          cell.owner = -1;
        }
        for (const [nr, nc] of this.neighbours(r, c)) {
          outgoing.push([nr, nc, owner]);
        }
      } else if (cell.count >= cm) {
        cell.count -= cm;
        if (cell.count <= 0) {
          cell.count = 0;
          cell.owner = -1;
        }
        for (const [nr, nc] of this.neighbours(r, c)) {
          outgoing.push([nr, nc, owner]);
        }
      }
    }

    // --- Step 2: apply orbs sequentially ---
    const nextWaveSet = new Set<string>();

    for (const [nr, nc, incOwner] of outgoing) {
      const nCell = this.grid[nr][nc];
      const cm = this.criticalMass(nr, nc);

      // Always capture on hit
      nCell.owner = incOwner;
      nCell.count += 1;

      const key = `${nr},${nc}`;
      if (nCell.count >= cm && !nextWaveSet.has(key)) {
        nCell.count -= cm;
        if (nCell.count < 0) nCell.count = 0;
        nextWaveSet.add(key);
        this.explosionQueue.push([nr, nc]);
        this.committedExplosions.add(key);
      }
    }

    // --- Post-wave ---
    this._checkEliminations();
    const winner = this._checkWinner();
    if (winner !== null) {
      this.state = "won";
      this.winner = winner;
      this.explosionQueue = [];
      this.committedExplosions.clear();
    } else if (this.explosionQueue.length === 0) {
      this._endTurn();
    }
  }

  // ------------------------------------------------------------------
  // Bookkeeping
  // ------------------------------------------------------------------

  _snapshot(): Snapshot {
    const grid: [number, number][] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        grid.push([cell.owner, cell.count]);
      }
    }
    return {
      grid,
      currentPlayer: this.currentPlayer,
      turnNumber: this.turnNumber,
      firstTurnDone: this.firstTurnDone.map(Number),
      alive: this.alive.map(Number),
      state: this.state,
      winner: this.winner,
    };
  }

  _restore(snap: Snapshot): void {
    const flat = snap.grid;
    let idx = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        cell.owner = flat[idx][0];
        cell.count = flat[idx][1];
        idx++;
      }
    }
    this.currentPlayer = snap.currentPlayer;
    this.turnNumber = snap.turnNumber;
    this.firstTurnDone = snap.firstTurnDone.map(Boolean);
    this.alive = snap.alive.map(Boolean);
    this.state = snap.state;
    this.winner = snap.winner;
    this.explosionQueue = [];
    this.committedExplosions.clear();
  }

  undo(): boolean {
    if (this.state !== "placing" || this.history.length === 0) return false;
    this._restore(this.history.pop()!);
    return true;
  }

  _checkEliminations(): void {
    const counts = new Array(this.numPlayers).fill(0);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.owner >= 0) {
          counts[cell.owner] += 1;
        }
      }
    }
    for (let p = 0; p < this.numPlayers; p++) {
      if (this.firstTurnDone[p] && counts[p] === 0) {
        this.alive[p] = false;
      }
    }
  }

  _checkWinner(): number | null {
    if (!this.firstTurnDone.every(Boolean)) return null;
    const alive = [];
    for (let p = 0; p < this.numPlayers; p++) {
      if (this.alive[p]) alive.push(p);
    }
    return alive.length === 1 ? alive[0] : null;
  }

  _endTurn(): void {
    this.state = "placing";
    let nxt = (this.currentPlayer + 1) % this.numPlayers;
    for (let i = 0; i < this.numPlayers; i++) {
      if (this.alive[nxt]) break;
      nxt = (nxt + 1) % this.numPlayers;
    }
    this.currentPlayer = nxt;
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  orbCounts(): number[] {
    const counts = new Array(this.numPlayers).fill(0);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.owner >= 0) {
          counts[cell.owner] += cell.count;
        }
      }
    }
    return counts;
  }
}
