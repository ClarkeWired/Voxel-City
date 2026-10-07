export const FIXED_STEP = 1 / 60;
export const MAX_FRAME_SECONDS = 0.05;
export const MAX_STEPS_PER_FRAME = 5;

export interface StepPlan {
  steps: number;
  alpha: number;
}

export class FixedStepAccumulator {
  private readonly dt: number;
  private readonly maxFrame: number;
  private readonly maxSteps: number;
  private accumulator = 0;

  constructor(dt = FIXED_STEP, maxFrame = MAX_FRAME_SECONDS, maxSteps = MAX_STEPS_PER_FRAME) {
    this.dt = dt;
    this.maxFrame = maxFrame;
    this.maxSteps = maxSteps;
  }

  advance(realSeconds: number): StepPlan {
    const frame =
      Number.isFinite(realSeconds) && realSeconds > 0 ? Math.min(realSeconds, this.maxFrame) : 0;
    this.accumulator = Math.min(this.accumulator + frame, this.dt * this.maxSteps);
    let steps = 0;
    while (this.accumulator >= this.dt) {
      this.accumulator -= this.dt;
      steps++;
    }
    return { steps, alpha: this.accumulator / this.dt };
  }

  get alpha(): number {
    return this.accumulator / this.dt;
  }
}
