// model-wrapper.ts — ONNX Runtime Web inference wrapper.
// Encodes game state → runs quantized DQN → returns Q-values.

import * as ort from 'onnxruntime-web/wasm';
import { Game } from '../game';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  mjs: '/ort-wasm-simd-threaded.mjs',
  wasm: '/ort-wasm-simd-threaded.wasm',
};

export class DQNModel {
  private session: ort.InferenceSession | null = null;
  private rows: number;
  private cols: number;
  private cmCache: Float32Array;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.cmCache = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tmp = new Game(2, rows, cols);
        this.cmCache[r * cols + c] = tmp.criticalMass(r, c) / 4.0;
      }
    }
  }

  async load(modelPath: string): Promise<void> {
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  /** Encode board from current player's perspective. */
  encodeState(game: Game, player: number): Float32Array {
    const n = this.rows * this.cols;
    const myCounts = new Float32Array(n);
    const enemyCounts = new Float32Array(n);
    const primedMap = new Float32Array(n);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = game.grid[r][c];
        const idx = r * this.cols + c;
        if (cell.owner === player) {
          myCounts[idx] = cell.count / 4.0;
          if (game.isPrimed(r, c)) {
            primedMap[idx] = 1.0;
          }
        } else if (cell.owner >= 0) {
          enemyCounts[idx] = cell.count / 4.0;
          if (game.isPrimed(r, c)) {
            primedMap[idx] = -1.0;
          }
        }
      }
    }

    // Stack 4 channels: [my, enemy, cm, primed]
    const result = new Float32Array(4 * n);
    result.set(myCounts, 0);
    result.set(enemyCounts, n);
    result.set(this.cmCache, 2 * n);
    result.set(primedMap, 3 * n);
    return result;
  }

  /** Boolean mask of legal actions. */
  validActionMask(game: Game, player: number): boolean[] {
    const mask = new Array(this.rows * this.cols).fill(false);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = game.grid[r][c];
        if (cell.isEmpty() || cell.owner === player) {
          mask[r * this.cols + c] = true;
        }
      }
    }
    return mask;
  }

  /** Run inference and return per-cell Q-values. */
  async predict(state: Float32Array): Promise<Float32Array> {
    if (!this.session) throw new Error('Model not loaded');
    const input = new ort.Tensor('float32', state, [1, 4, this.rows, this.cols]);
    const inputName = this.session.inputNames[0];
    const results = await this.session.run({ [inputName]: input });
    const outputName = this.session.outputNames[0];
    const tensor = results[outputName] as ort.Tensor;
    return tensor.data as Float32Array;
  }
}
