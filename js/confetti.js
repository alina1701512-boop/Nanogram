  // ===================== CONFETTI =====================
  export const Confetti = {
    canvas: null, ctx: null, particles: [], animationId: null,
    init() {
      this.canvas = document.getElementById('confetti-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; },
    spawn() {
      const colors = ['#663af3', '#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#ff9ff3', '#54a0ff'];
      for (let i = 0; i < 150; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width, y: -20 - Math.random() * 200,
          w: Math.random() * 8 + 4, h: Math.random() * 6 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2,
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.2, life: 1
        });
      }
      if (!this.animationId) this.animate();
    },
    animate() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.particles = this.particles.filter(p => p.life > 0);
      for (const p of this.particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.vr; p.life -= 0.005;
        this.ctx.save(); this.ctx.translate(p.x, p.y); this.ctx.rotate(p.rot);
        this.ctx.globalAlpha = Math.max(0, p.life); this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); this.ctx.restore();
      }
      if (this.particles.length > 0) this.animationId = requestAnimationFrame(() => this.animate());
      else { this.animationId = null; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    }
  };
