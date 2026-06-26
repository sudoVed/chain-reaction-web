export interface Move { r: number; c: number; }

export interface Game {
  numPlayers: number;
  rows: number;
  cols: number;
  grid: { owner: number; count: number }[][];
  currentPlayer: number;
  state: string;
  canPlace(r: number, c: number): boolean;
  isPrimed(r: number, c: number): boolean;
  neighbours(r: number, c: number): [number, number][];
  criticalMass(r: number, c: number): number;
  orbCounts(): number[];
  _snapshot(): object;
  _restore(snap: object): void;
}

/** All legal moves for player. */
export function legalMoves(game: Game, player: number): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      if (cell.owner === -1 || cell.owner === player) {
        moves.push({ r, c });
      }
    }
  }
  return moves;
}

/** Set of (r,c) where enemy has a primed cell. */
function enemyPrimedSet(game: Game, player: number): Set<string> {
  const enemy = 1 - player;
  const s = new Set<string>();
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      if (cell.owner === enemy && game.isPrimed(r, c)) {
        s.add(`${r},${c}`);
      }
    }
  }
  return s;
}

// ------------------------------------------------------------------
// Greedy capture policy
// ------------------------------------------------------------------

export function greedyCapturePolicy(game: Game, player: number): Move {
  const moves = legalMoves(game, player);
  const enemySet = enemyPrimedSet(game, player);

  // Tier 1: own primed cell adjacent to enemy primed cell
  const tier1 = moves.filter(({ r, c }) => {
    if (!game.isPrimed(r, c)) return false;
    return game.neighbours(r, c).some(([nr, nc]) => enemySet.has(`${nr},${nc}`));
  });
  if (tier1.length) return tier1[Math.floor(Math.random() * tier1.length)];

  // Tier 2: any own primed cell
  const tier2 = moves.filter(({ r, c }) => game.isPrimed(r, c));
  if (tier2.length) return tier2[Math.floor(Math.random() * tier2.length)];

  // Tier 3: random fallback
  return moves[Math.floor(Math.random() * moves.length)];
}

// ------------------------------------------------------------------
// Defensive policy
// ------------------------------------------------------------------

export function defensivePolicy(game: Game, player: number): Move {
  const moves = legalMoves(game, player);
  const enemySet = enemyPrimedSet(game, player);

  const isDangerous = (r: number, c: number): boolean => {
    return game.neighbours(r, c).some(([nr, nc]) => enemySet.has(`${nr},${nc}`));
  };

  const safeMoves = moves.filter(({ r, c }) => !isDangerous(r, c));

  // Tier 1: safe own primed adjacent to enemy primed (preemptive)
  const tier1 = safeMoves.filter(({ r, c }) => {
    if (!game.isPrimed(r, c)) return false;
    return game.neighbours(r, c).some(([nr, nc]) => enemySet.has(`${nr},${nc}`));
  });
  if (tier1.length) return tier1[Math.floor(Math.random() * tier1.length)];

  // Tier 2: safe own primed
  const tier2 = safeMoves.filter(({ r, c }) => game.isPrimed(r, c));
  if (tier2.length) return tier2[Math.floor(Math.random() * tier2.length)];

  // Tier 3: any safe move
  if (safeMoves.length) return safeMoves[Math.floor(Math.random() * safeMoves.length)];

  // Tier 4: dangerous own primed (last resort attack)
  const tier4 = moves.filter(({ r, c }) => game.isPrimed(r, c));
  if (tier4.length) return tier4[Math.floor(Math.random() * tier4.length)];

  // Tier 5: absolute fallback
  return moves[Math.floor(Math.random() * moves.length)];
}
