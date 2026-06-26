// analysis.ts — Board analysis helpers. Port of rl/game_analysis.py.
// All stateless, uses snapshot/restore to avoid mutating live game state.

import { Game, Move } from './policies';
import { greedyCapturePolicy } from './policies';

type ReplyFn = (game: Game, enemy: number) => Move;

// ------------------------------------------------------------------
// Connected-component helpers
// ------------------------------------------------------------------

function primedComponents(game: Game): Set<string>[] {
  const allPrimed = new Set<string>();
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      if (cell.owner >= 0 && game.isPrimed(r, c)) {
        allPrimed.add(`${r},${c}`);
      }
    }
  }

  const visited = new Set<string>();
  const components: Set<string>[] = [];

  for (const start of allPrimed) {
    if (visited.has(start)) continue;
    const comp = new Set<string>();
    const frontier: string[] = [start];
    while (frontier.length) {
      const pos = frontier.pop()!;
      if (visited.has(pos)) continue;
      visited.add(pos);
      comp.add(pos);
      const [r, c] = pos.split(',').map(Number);
      for (const [nr, nc] of game.neighbours(r, c)) {
        const key = `${nr},${nc}`;
        if (allPrimed.has(key) && !visited.has(key)) {
          frontier.push(key);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

// ------------------------------------------------------------------
// Exposure helpers
// ------------------------------------------------------------------

export function countExposure(game: Game, player: number): number {
  const enemy = 1 - player;
  const enemyPrimed = new Set<string>();
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      if (cell.owner === enemy && game.isPrimed(r, c)) {
        enemyPrimed.add(`${r},${c}`);
      }
    }
  }

  let count = 0;
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      if (cell.owner === player && game.isPrimed(r, c)) {
        if (game.neighbours(r, c).some(([nr, nc]) => enemyPrimed.has(`${nr},${nc}`))) {
          count++;
        }
      }
    }
  }
  return count;
}

export function hasBigCluster(game: Game, player: number): boolean {
  const myPrimed = new Set<string>();
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      if (cell.owner === player && game.isPrimed(r, c)) {
        myPrimed.add(`${r},${c}`);
      }
    }
  }

  const comps = primedComponents(game);
  return comps.some(comp => comp.size >= 4 && [...comp].some(key => myPrimed.has(key)));
}

// ------------------------------------------------------------------
// Risk filter
// ------------------------------------------------------------------

export function moveRiskScore(game: Game, player: number, r: number, c: number, replyFn?: ReplyFn): number {
  const reply = replyFn ?? greedyCapturePolicy;
  const enemy = 1 - player;
  const totalOrbs = game.orbCounts().reduce((a, b) => a + b, 0);
  if (totalOrbs < 20) return 0.0;

  const snap = game._snapshot();

  // Snapshot 1: before our move
  let myPrimedStart = 0;
  let myUnprimedStart = 0;
  for (let rr = 0; rr < game.rows; rr++) {
    for (let cc = 0; cc < game.cols; cc++) {
      const cell = game.grid[rr][cc];
      if (cell.owner === player) {
        if (game.isPrimed(rr, cc)) myPrimedStart++;
        else myUnprimedStart++;
      }
    }
  }

  // Simulate our placement + cascade
  game.grid[r][c].owner = player;
  game.grid[r][c].count += 1;
  if (game.grid[r][c].count >= game.criticalMass(r, c)) {
    (game as any).state = 'animating';
    (game as any).explosionQueue.push([r, c]);
    let safety = 0;
    while ((game as any).state === 'animating' && safety < 10000) {
      const wave = (game as any).getWave();
      if (!wave.length) break;
      (game as any).applyWave(wave);
      safety++;
    }
  }

  // If our move won, no risk
  if ((game as any).winner !== null && (game as any).winner !== -1) {
    game._restore(snap);
    return 0.0;
  }

  // Snapshot 2: after our cascade
  let myPrimedMid = 0;
  let myUnprimedMid = 0;
  for (let rr = 0; rr < game.rows; rr++) {
    for (let cc = 0; cc < game.cols; cc++) {
      const cell = game.grid[rr][cc];
      if (cell.owner === player) {
        if (game.isPrimed(rr, cc)) myPrimedMid++;
        else myUnprimedMid++;
      }
    }
  }

  const ourGain = 1.0 * Math.max(myPrimedMid - myPrimedStart, 0)
                + 0.2 * Math.max(myUnprimedMid - myUnprimedStart, 0);

  // Enemy's single best retaliatory move
  const erMove = reply(game, enemy);
  const er = erMove.r;
  const ec = erMove.c;
  game.grid[er][ec].count += 1;
  if (game.grid[er][ec].count >= game.criticalMass(er, ec)) {
    (game as any).state = 'animating';
    (game as any).explosionQueue.push([er, ec]);
    let safety = 0;
    while ((game as any).state === 'animating' && safety < 10000) {
      const wave = (game as any).getWave();
      if (!wave.length) break;
      (game as any).applyWave(wave);
      safety++;
    }
  }

  // Snapshot 3: after enemy reply
  let myPrimedAfter = 0;
  let myUnprimedAfter = 0;
  for (let rr = 0; rr < game.rows; rr++) {
    for (let cc = 0; cc < game.cols; cc++) {
      const cell = game.grid[rr][cc];
      if (cell.owner === player) {
        if (game.isPrimed(rr, cc)) myPrimedAfter++;
        else myUnprimedAfter++;
      }
    }
  }

  const ourLoss = 1.0 * Math.max(myPrimedMid - myPrimedAfter, 0)
                + 0.2 * Math.max(myUnprimedMid - myUnprimedAfter, 0);

  game._restore(snap);
  return Math.max(0.0, ourLoss - ourGain);
}
