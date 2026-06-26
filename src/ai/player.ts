// player.ts — AI opponent for human-vs-AI play.
// Port of ai_player.py. Wraps fixed policies and the trained DQN model.

import { Game } from '../game';
import { defensivePolicy, greedyCapturePolicy } from './policies';
import { countExposure, hasBigCluster, moveRiskScore } from './analysis';
import { DQNModel } from './model-wrapper';

export type AIMode = 'defensive' | 'greedy' | 'smart';

export class AIPlayer {
  private mode: AIMode;
  private model: DQNModel | null = null;
  private pendingMove: [number, number] | null = null;
  private thinkingPromise: Promise<void> | null = null;

  private constructor(mode: AIMode, model: DQNModel | null) {
    this.mode = mode;
    this.model = model;
  }

  static async create(mode: AIMode, rows: number, cols: number): Promise<AIPlayer> {
    if (mode === 'smart') {
      const model = new DQNModel(rows, cols);
      // The model path is relative to the built output. In dev, Vite serves from public/.
      await model.load('/model/dqn-quant.onnx');
      return new AIPlayer(mode, model);
    }
    return new AIPlayer(mode, null);
  }

  /**
   * Kick off move computation asynchronously.
   * Call this when the AI's turn starts. The game loop should then
   * wait for the AI's delay timer before calling takeMove().
   */
  startThink(game: Game, player: number): void {
    if (this.thinkingPromise || this.pendingMove) return;

    this.thinkingPromise = (async () => {
      this.pendingMove = await this._computeMove(game, player);
    })();
  }

  /** True if a move has been computed and is ready. */
  hasMove(): boolean {
    return this.pendingMove !== null;
  }

  /** Consume and return the computed move. Throws if not ready. */
  takeMove(): [number, number] {
    if (!this.pendingMove) {
      throw new Error('AI move not ready yet');
    }
    const move = this.pendingMove;
    this.pendingMove = null;
    this.thinkingPromise = null;
    return move;
  }

  /** Synchronous wrapper for non-smart modes (never used for smart). */
  pickMove(game: Game, player: number): [number, number] {
    if (this.mode === 'defensive') {
      const m = defensivePolicy(game, player);
      return [m.r, m.c];
    }
    if (this.mode === 'greedy') {
      const m = greedyCapturePolicy(game, player);
      return [m.r, m.c];
    }
    throw new Error('Smart mode requires async startThink/takeMove');
  }

  // ------------------------------------------------------------------
  // Smart (DQN) implementation
  // ------------------------------------------------------------------

  private async _computeMove(game: Game, player: number): Promise<[number, number]> {
    if (this.mode !== 'smart' || !this.model) {
      return this.pickMove(game, player);
    }

    // Force-greedy override
    if (countExposure(game, player) > 0 && hasBigCluster(game, player)) {
      const m = greedyCapturePolicy(game, player);
      return [m.r, m.c];
    }

    // Encode state and get Q-values
    const state = this.model.encodeState(game, player);
    const mask = this.model.validActionMask(game, player);
    const qVals = await this.model.predict(state);

    // Mask illegal moves
    const qMasked = new Float32Array(qVals.length);
    for (let i = 0; i < qVals.length; i++) {
      qMasked[i] = mask[i] ? qVals[i] : -1e9;
    }

    // Sort actions by Q-value descending
    const actions = Array.from({ length: qVals.length }, (_, i) => i);
    actions.sort((a, b) => qMasked[b] - qMasked[a]);

    const legalActions = actions.filter(a => mask[a]);

    // For the risk filter, we use greedy policy as the reply function
    // to avoid N additional async model inferences. This is a slight
    // simplification vs the Python version which uses the model itself
    // as the reply function, but keeps the web version fast & simple.
    for (const action of legalActions) {
      const r = Math.floor(action / game.cols);
      const c = action % game.cols;
      const risk = moveRiskScore(game, player, r, c, greedyCapturePolicy);
      if (risk === 0.0) {
        return [r, c];
      }
    }

    // All moves risky — pick least damaging (already sorted by Q, so first is best)
    const best = legalActions[0];
    return [Math.floor(best / game.cols), best % game.cols];
  }
}
