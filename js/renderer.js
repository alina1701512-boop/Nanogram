import { Palette } from './palette.js';

  // ===================== RENDERER =====================
  // Полосы подсказок «приклеены» к краям канвы и не участвуют в зуме/панораме —
  // едет только само поле под ними, как заголовки в таблице. Отрисовывается
  // только видимая часть поля, кадр рисуется по флагу «что-то изменилось»,
  // а не непрерывно. Прежнее разделение на статический/динамический слои
  // не работало (флаг взводился почти отовсюду) и просто убрано.
  const MIN_ZOOM = 1;
  const MAX_ZOOM_CAP = 10;
  const MAX_CELL_PX = 92;

  export class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = 1;
      this.cssW = 0; this.cssH = 0;
      this.baseCellSize = 20;
      this.maxZoom = MAX_ZOOM_CAP;
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.state = null;
      this.drawingLine = null;
      this.hoverCell = null;
      this.cursorCell = null;
      this.errorFlash = null;
      this.dirty = true;
    }

    setState(state) {
      this.state = state;
      this.zoom = 1; this.panX = 0; this.panY = 0;
      this.hoverCell = null; this.cursorCell = null; this.errorFlash = null;
      this.computeSizes();
      this.markDirty();
    }

    markDirty() { this.dirty = true; }

    // Размер шрифта подсказок и ширина полосы под них считаются одной и той же
    // формулой и при раскладке, и при отрисовке — раньше формулы расходились,
    // и на некоторых пропорциях экрана числа вылезали за свою полосу.
    hintFontSize(cell) { return Math.max(9, Math.min(cell * 0.55, 22)); }
    gutterSize(maxHints, cell) { return Math.max(26, this.hintFontSize(cell) * 1.15 * Math.max(1, maxHints) + 10); }

    getMaxHints(kind) {
      if (!this.state) return 1;
      let max = 1;
      const n = this.state.size;
      for (let i = 0; i < n; i++) {
        const len = (kind === 'row' ? this.state.getRowHints(i) : this.state.getColHints(i)).length;
        if (len > max) max = len;
      }
      return max;
    }

    computeSizes() {
      const wrap = document.getElementById('canvas-wrap');
      const cssW = Math.max(1, wrap.clientWidth - 16);
      const cssH = Math.max(1, wrap.clientHeight - 16);
      this.cssW = cssW; this.cssH = cssH;
      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(cssW * this.dpr);
      this.canvas.height = Math.round(cssH * this.dpr);
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      if (!this.state) { this.baseCellSize = 20; return; }
      const size = this.state.size;
      const maxRowHints = this.getMaxHints('row');
      const maxColHints = this.getMaxHints('col');

      // Ширина полос зависит от размера клетки, а размер клетки — от того, сколько
      // места останется после полос. Три шага фиксированной точки сходятся с
      // избытком: полосы почти не меняются между итерациями.
      let cell = Math.max(4, Math.min(40, Math.min(cssW, cssH) / size));
      for (let i = 0; i < 3; i++) {
        const rowGutter = this.gutterSize(maxColHints, cell); // полоса СВЕРХУ — от числа групп в столбцах
        const colGutter = this.gutterSize(maxRowHints, cell); // полоса СЛЕВА — от числа групп в строках
        cell = Math.max(4, Math.min(40, Math.min((cssW - colGutter) / size, (cssH - rowGutter) / size)));
      }
      this.baseCellSize = cell;
      this.maxZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM_CAP, MAX_CELL_PX / cell));
      this.zoom = Math.min(this.zoom, this.maxZoom);
      this.clampPan();
    }

    effectiveCell() { return this.baseCellSize * this.zoom; }

    // Полосы: слева — по числу групп в строках, сверху — по числу групп в столбцах.
    gutters() {
      const cell = this.effectiveCell();
      return {
        left: this.gutterSize(this.getMaxHints('row'), cell),
        top: this.gutterSize(this.getMaxHints('col'), cell)
      };
    }

    // Прямоугольник, где рисуется само поле — весь canvas за вычетом полос.
    boardViewport() {
      const g = this.gutters();
      return { x: g.left, y: g.top, w: this.cssW - g.left, h: this.cssH - g.top, gLeft: g.left, gTop: g.top };
    }

    clampPan() {
      if (!this.state) return;
      const vp = this.boardViewport();
      const cell = this.effectiveCell();
      const boardW = this.state.size * cell, boardH = this.state.size * cell;
      const clampAxis = (pan, boardLen, viewLen) => {
        if (boardLen <= viewLen) return (viewLen - boardLen) / 2;
        const minPan = viewLen - boardLen, maxPan = 0;
        return Math.max(minPan, Math.min(maxPan, pan));
      };
      this.panX = clampAxis(this.panX, boardW, vp.w);
      this.panY = clampAxis(this.panY, boardH, vp.h);
    }

    getBoardOrigin() {
      const vp = this.boardViewport();
      return { x: vp.x + this.panX, y: vp.y + this.panY };
    }

    screenToCell(x, y) {
      const origin = this.getBoardOrigin();
      const cell = this.effectiveCell();
      return { r: Math.floor((y - origin.y) / cell), c: Math.floor((x - origin.x) / cell) };
    }

    inBounds(cell) {
      return !!this.state && cell.r >= 0 && cell.c >= 0 && cell.r < this.state.size && cell.c < this.state.size;
    }

    // Зум к точке экрана: точка под пальцем/курсором остаётся на месте.
    zoomAt(screenX, screenY, newZoom) {
      const clamped = Math.max(MIN_ZOOM, Math.min(this.maxZoom, newZoom));
      const cellBefore = this.effectiveCell();
      const originBefore = this.getBoardOrigin();
      const br = (screenX - originBefore.x) / cellBefore;
      const bc = (screenY - originBefore.y) / cellBefore;
      this.zoom = clamped;
      const cellAfter = this.effectiveCell();
      const vp = this.boardViewport();
      this.panX = screenX - br * cellAfter - vp.x;
      this.panY = screenY - bc * cellAfter - vp.y;
      this.clampPan();
      this.markDirty();
    }

    zoomBy(factor, screenX, screenY) { this.zoomAt(screenX, screenY, this.zoom * factor); }

    panBy(dx, dy) {
      this.panX += dx; this.panY += dy;
      this.clampPan();
      this.markDirty();
    }

    zoomFit() { this.zoom = MIN_ZOOM; this.panX = 0; this.panY = 0; this.clampPan(); this.markDirty(); }

    isFit() { return Math.abs(this.zoom - MIN_ZOOM) < 0.01; }

    setDrawingLine(cells) { this.drawingLine = cells; this.markDirty(); }
    clearDrawingLine() { if (this.drawingLine) { this.drawingLine = null; this.markDirty(); } }
    setHoverCell(cell) { this.hoverCell = cell; this.markDirty(); }
    setCursorCell(cell) { this.cursorCell = cell; this.markDirty(); }
    setErrorFlash(cells) { this.errorFlash = { cells, start: Date.now() }; this.markDirty(); }

    hasLiveAnimation() {
      if (this.errorFlash && Date.now() - this.errorFlash.start < 400) return true;
      if (this.state && this.state.lineAnimations.length) return true;
      if (this.state && this.state.hintCells.size) return true;
      return false;
    }

    draw() {
      if (!this.state) return;
      this.dirty = false;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.cssW, this.cssH);
      this.drawBoard();
      this.drawHints();
      this.drawStrokePreview();
    }

    // Диапазон клеток, реально попадающих в видимую область поля — рисовать
    // остальные незачем, особенно при зуме на большом кроссворде.
    visibleRange() {
      const origin = this.getBoardOrigin();
      const cell = this.effectiveCell();
      const vp = this.boardViewport();
      const size = this.state.size;
      const r0 = Math.max(0, Math.floor((vp.y - origin.y) / cell));
      const r1 = Math.min(size - 1, Math.ceil((vp.y + vp.h - origin.y) / cell));
      const c0 = Math.max(0, Math.floor((vp.x - origin.x) / cell));
      const c1 = Math.min(size - 1, Math.ceil((vp.x + vp.w - origin.x) / cell));
      return { r0, r1, c0, c1 };
    }

    drawBoard() {
      const ctx = this.ctx;
      const cell = this.effectiveCell();
      const size = this.state.size;
      const origin = this.getBoardOrigin();
      const vp = this.boardViewport();
      const now = Date.now();

      ctx.save();
      ctx.beginPath();
      ctx.rect(vp.x, vp.y, vp.w, vp.h);
      ctx.clip();

      if (this.hoverCell && this.inBounds(this.hoverCell)) {
        ctx.fillStyle = Palette.get('--color-highlight');
        ctx.fillRect(vp.x, origin.y + this.hoverCell.r * cell, vp.w, cell);
        ctx.fillRect(origin.x + this.hoverCell.c * cell, vp.y, cell, vp.h);
      }

      for (const anim of this.state.lineAnimations) {
        const progress = Math.min(1, (now - anim.start) / 800);
        const alpha = 0.4 * (1 - progress);
        ctx.fillStyle = `rgba(38, 150, 132, ${alpha})`;
        if (anim.type === 'row') ctx.fillRect(vp.x, origin.y + anim.index * cell, vp.w * progress, cell);
        else ctx.fillRect(origin.x + anim.index * cell, vp.y, cell, vp.h * progress);
      }

      const { r0, r1, c0, c1 } = this.visibleRange();
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = origin.x + c * cell, y = origin.y + r * cell;
          const val = this.state.grid[r][c];
          const memoVal = this.state.memoGrid[r][c];
          const hasHint = this.state.hasHint(r, c);
          const rowSolved = this.state.solvedLines.rows.has(r);
          const colSolved = this.state.solvedLines.cols.has(c);

          ctx.fillStyle = Palette.get('--color-cell-bg');
          ctx.fillRect(x, y, cell, cell);

          if (rowSolved || colSolved) {
            ctx.fillStyle = Palette.get('--color-solved');
            ctx.fillRect(x, y, cell, cell);
          }

          if (hasHint && val !== 1) {
            ctx.fillStyle = Palette.get('--color-hint');
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200);
            ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            ctx.globalAlpha = 1;
          }

          if (val === 1) {
            ctx.fillStyle = Palette.get('--color-fill');
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          } else if (val === 2) {
            ctx.strokeStyle = Palette.get('--color-x');
            ctx.lineWidth = Math.max(1, cell / 6);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x + cell * 0.25, y + cell * 0.25); ctx.lineTo(x + cell * 0.75, y + cell * 0.75); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + cell * 0.75, y + cell * 0.25); ctx.lineTo(x + cell * 0.25, y + cell * 0.75); ctx.stroke();
          }

          if (memoVal === 1 && val !== 1) {
            ctx.fillStyle = Palette.get('--color-memo');
            ctx.beginPath();
            ctx.moveTo(x + cell * 0.5, y + cell * 0.15);
            ctx.lineTo(x + cell * 0.15, y + cell * 0.85);
            ctx.lineTo(x + cell * 0.85, y + cell * 0.85);
            ctx.closePath(); ctx.fill();
          }

          if (cell > 4) {
            ctx.strokeStyle = Palette.get('--color-cell-border');
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
        }
      }

      // Толстые линии сетки — насквозь через всё поле, а не по периметру
      // каждой клетки: и быстрее, и не даёт двойной толщины на стыках.
      ctx.strokeStyle = Palette.get('--color-grid-border');
      ctx.lineWidth = 1.5;
      for (let c = 5; c < size; c += 5) {
        const x = origin.x + c * cell;
        if (x < vp.x - 2 || x > vp.x + vp.w + 2) continue;
        ctx.beginPath(); ctx.moveTo(x, Math.max(vp.y, origin.y)); ctx.lineTo(x, Math.min(vp.y + vp.h, origin.y + size * cell)); ctx.stroke();
      }
      for (let r = 5; r < size; r += 5) {
        const y = origin.y + r * cell;
        if (y < vp.y - 2 || y > vp.y + vp.h + 2) continue;
        ctx.beginPath(); ctx.moveTo(Math.max(vp.x, origin.x), y); ctx.lineTo(Math.min(vp.x + vp.w, origin.x + size * cell), y); ctx.stroke();
      }

      if (this.cursorCell && this.inBounds(this.cursorCell)) {
        const x = origin.x + this.cursorCell.c * cell, y = origin.y + this.cursorCell.r * cell;
        ctx.strokeStyle = Palette.get('--color-hint');
        ctx.lineWidth = Math.max(2, cell / 10);
        ctx.setLineDash([Math.max(3, cell / 6), Math.max(2, cell / 10)]);
        ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = Palette.get('--color-grid-border');
      ctx.lineWidth = 2;
      ctx.strokeRect(origin.x, origin.y, size * cell, size * cell);

      if (this.errorFlash) {
        const elapsed = now - this.errorFlash.start;
        if (elapsed < 400) {
          const alpha = 0.5 * (1 - elapsed / 400);
          ctx.fillStyle = `rgba(255, 71, 87, ${alpha})`;
          for (const [r, c] of this.errorFlash.cells) ctx.fillRect(origin.x + c * cell, origin.y + r * cell, cell, cell);
        } else {
          this.errorFlash = null;
        }
      }

      ctx.restore();
    }

    // Штрих ещё не применённых клеток при рисовании мышью показывается поверх поля
    // (реальные ходы уже применяются в GameState live — это только курсорный хвост).
    drawStrokePreview() {
      if (!this.drawingLine || !this.drawingLine.length) return;
      const ctx = this.ctx;
      const cell = this.effectiveCell();
      const origin = this.getBoardOrigin();
      ctx.strokeStyle = Palette.get('--color-hint');
      ctx.lineWidth = Math.max(1.5, cell / 12);
      for (const { r, c } of this.drawingLine) {
        const x = origin.x + c * cell, y = origin.y + r * cell;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }

    // Полосы подсказок рисуются последними и поверх поля — они не участвуют
    // в зуме/панораме и всегда остаются у левого и верхнего края canvas.
    drawHints() {
      const ctx = this.ctx;
      const cell = this.effectiveCell();
      const origin = this.getBoardOrigin();
      const vp = this.boardViewport();
      const fontSize = this.hintFontSize(cell);
      const size = this.state.size;

      ctx.fillStyle = Palette.get('--color-cell-bg');
      ctx.fillRect(0, 0, this.cssW, vp.y);
      ctx.fillRect(0, 0, vp.x, this.cssH);

      ctx.font = `${fontSize}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const solvedColor = Palette.get('--color-solved-text');
      const normalColor = Palette.get('--color-frost-glow');
      const hoverColor = Palette.get('--color-hint');

      const { r0, r1, c0, c1 } = this.visibleRange();

      ctx.save();
      ctx.beginPath(); ctx.rect(0, vp.y, vp.x, vp.h); ctx.clip();
      for (let r = r0; r <= r1; r++) {
        const hints = this.state.getRowHints(r);
        const y = origin.y + r * cell + cell / 2;
        const isCursor = (this.hoverCell && this.hoverCell.r === r) || (this.cursorCell && this.cursorCell.r === r);
        ctx.fillStyle = this.state.solvedLines.rows.has(r) ? solvedColor : (isCursor ? hoverColor : normalColor);
        for (let i = 0; i < hints.length; i++) {
          const hintX = vp.x - 8 - (hints.length - 1 - i) * (fontSize * 1.15);
          ctx.fillText(hints[i], hintX, y);
        }
      }
      ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(vp.x, 0, vp.w, vp.y); ctx.clip();
      for (let c = c0; c <= c1; c++) {
        const hints = this.state.getColHints(c);
        const x = origin.x + c * cell + cell / 2;
        const isCursor = (this.hoverCell && this.hoverCell.c === c) || (this.cursorCell && this.cursorCell.c === c);
        ctx.fillStyle = this.state.solvedLines.cols.has(c) ? solvedColor : (isCursor ? hoverColor : normalColor);
        for (let i = 0; i < hints.length; i++) {
          const hintY = vp.y - 8 - (hints.length - 1 - i) * (fontSize * 1.15);
          ctx.fillText(hints[i], x, hintY);
        }
      }
      ctx.restore();

      ctx.strokeStyle = Palette.get('--color-grid-border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(vp.x - 0.5, 0); ctx.lineTo(vp.x - 0.5, this.cssH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, vp.y - 0.5); ctx.lineTo(this.cssW, vp.y - 0.5); ctx.stroke();
    }
  }
