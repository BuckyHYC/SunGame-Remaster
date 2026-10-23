/** 固定步长主循环：逻辑 60Hz，渲染跟随 rAF */
export class Loop {
  private readonly fixedDt = 1 / 60;
  private readonly maxSteps = 5;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const elapsed = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    this.acc += elapsed;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < this.maxSteps) {
      this.update(this.fixedDt);
      this.acc -= this.fixedDt;
      steps++;
    }
    if (steps === this.maxSteps) this.acc = 0;
    this.render();
    this.raf = requestAnimationFrame(this.tick);
  };
}
