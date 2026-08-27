import { SoundManager } from './sound.js';
import { Haptics } from './haptics.js';

  // ===================== INPUT HANDLER =====================
  // Создаётся ровно один раз за сеанс — партия подключается через setGame().
  //
  // Один палец рисует: действие определяется один раз по первой клетке штриха
  // и не меняется до отпускания. Два пальца — зум и панорама; как только
  // опускается второй палец, начатый штрих откатывается (revertLive), сколько бы
  // клеток он уже успел живьём закрасить. Долгое нажатие ставит крестик, не
  // выходя из режима закраски — это то, для чего раньше служила бесполезная
  // «защита от случайных касаний» (пропадавшие быстрые тапы и свайпы).
  export class InputHandler {
    constructor(renderer, callbacks) {
      this.renderer = renderer;
      this.game = null;
      this.cb = callbacks;
      this.canvas = renderer.canvas;
      this.mode = 'paint';
      this.longPressEnabled = true;

      this.pointers = new Map();

      this.strokeActive = false;
      this.strokePointerId = null;
      this.strokeAction = null;
      this.strokeStartCell = null;
      this.strokeLastCell = null;
      this.strokeAxis = null;
      this.strokeChanges = [];
      this.strokeTouched = new Set();
      this.strokeHasMoved = false;
      this.strokeStartX = 0; this.strokeStartY = 0;
      this.strokeStartCanvasX = 0; this.strokeStartCanvasY = 0;
      this.longPressTimer = null;
      this.longPressFired = false;

      this.gestureActive = false;
      this.gestureIds = [];
      this.gestureStart = null;

      this.lastTapTime = 0;
      this.lastTapCell = null;

      this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
      this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
      this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
      this.canvas.addEventListener('pointercancel', this.onPointerCancel.bind(this));
      this.canvas.addEventListener('pointerleave', e => { if (!this.pointers.has(e.pointerId)) this.renderer.setHoverCell(null); });
      this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
      this.canvas.addEventListener('dblclick', e => e.preventDefault());
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    setMode(mode) { this.mode = mode; }
    setLongPress(enabled) { this.longPressEnabled = enabled; }

    // Переключение на другую партию: тот же экземпляр, новое состояние.
    setGame(game) {
      this.game = game;
      this.pointers.clear();
      this.strokeActive = false;
      this.gestureActive = false;
      this.gestureIds = [];
      this.cancelLongPress();
      this.strokeChanges = [];
      this.renderer.clearDrawingLine();
      this.renderer.setHoverCell(null);
      this.renderer.setCursorCell(null);
    }

    getCanvasCoords(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    cancelLongPress() { if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; } }

    // ---------- указатели ----------

    onPointerDown(e) {
      e.preventDefault();
      if (!this.game) return;
      this.canvas.setPointerCapture(e.pointerId);
      const p = this.getCanvasCoords(e);
      this.pointers.set(e.pointerId, p);

      if (this.pointers.size === 2) { this.beginGesture(); return; }
      if (this.pointers.size > 2) return;

      this.strokeActive = true;
      this.strokePointerId = e.pointerId;
      this.strokeAction = null;
      this.strokeStartCell = this.renderer.screenToCell(p.x, p.y);
      this.strokeLastCell = null;
      this.strokeAxis = null;
      this.strokeChanges = [];
      this.strokeTouched = new Set();
      this.strokeHasMoved = false;
      this.strokeStartX = e.clientX; this.strokeStartY = e.clientY;
      this.strokeStartCanvasX = p.x; this.strokeStartCanvasY = p.y;
      this.longPressFired = false;
      this.renderer.setHoverCell(this.strokeStartCell);

      if (this.longPressEnabled && this.mode === 'paint' && this.renderer.inBounds(this.strokeStartCell)) {
        this.longPressTimer = setTimeout(() => this.fireLongPress(), 420);
      }
    }

    onPointerMove(e) {
      if (!this.game) return;
      if (!this.pointers.has(e.pointerId)) {
        const p = this.getCanvasCoords(e);
        this.renderer.setHoverCell(this.renderer.screenToCell(p.x, p.y));
        return;
      }
      const p = this.getCanvasCoords(e);
      this.pointers.set(e.pointerId, p);
      e.preventDefault();

      if (this.gestureActive) { this.updateGesture(); return; }
      if (!this.strokeActive || e.pointerId !== this.strokePointerId) return;

      const movDx = e.clientX - this.strokeStartX, movDy = e.clientY - this.strokeStartY;
      if (!this.strokeHasMoved && Math.hypot(movDx, movDy) > 8) {
        this.strokeHasMoved = true;
        this.cancelLongPress();
      }
      if (!this.strokeHasMoved || this.longPressFired) return;

      const cell = this.renderer.screenToCell(p.x, p.y);
      if (!this.renderer.inBounds(cell)) return;

      // Ось фиксируется по первому смещению больше одной клетки и дальше не меняется.
      if (!this.strokeAxis) {
        const dr = cell.r - this.strokeStartCell.r, dc = cell.c - this.strokeStartCell.c;
        if (dr || dc) this.strokeAxis = Math.abs(dr) >= Math.abs(dc) ? 'v' : 'h';
      }
      if (this.strokeAxis === 'v') cell.c = this.strokeStartCell.c;
      else if (this.strokeAxis === 'h') cell.r = this.strokeStartCell.r;

      this.extendStroke(cell);
      this.renderer.setHoverCell(cell);
    }

    onPointerUp(e) {
      e.preventDefault();
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      this.pointers.delete(e.pointerId);

      if (this.gestureActive) {
        if (this.gestureIds.includes(e.pointerId)) { this.gestureActive = false; this.gestureIds = []; }
        return;
      }
      if (!this.strokeActive || e.pointerId !== this.strokePointerId) return;

      this.cancelLongPress();
      this.strokeActive = false;
      this.renderer.clearDrawingLine();

      if (!this.game) { this.strokeChanges = []; return; }

      if (!this.longPressFired) {
        if (!this.strokeHasMoved) {
          // Тап — штрих из одной клетки. Двойной тап по той же клетке переключает
          // зум и не красит её второй раз (иначе два тапа гасили бы друг друга).
          const cell = this.strokeStartCell;
          if (this.renderer.inBounds(cell) && !this.game.solved) {
            const now = Date.now();
            const isDoubleTap = this.lastTapCell && this.lastTapCell.r === cell.r && this.lastTapCell.c === cell.c
              && now - this.lastTapTime < 300;
            if (isDoubleTap) {
              this.lastTapTime = 0; this.lastTapCell = null;
              this.toggleZoom(this.strokeStartCanvasX, this.strokeStartCanvasY);
            } else {
              this.processCells([cell]);
              this.lastTapTime = now; this.lastTapCell = cell;
            }
          }
        } else {
          this.lastTapTime = 0; this.lastTapCell = null;
        }
      }

      if (this.strokeChanges.length) this.game.finalizeStroke(this.strokeChanges);
      this.strokeChanges = [];
      this.strokeAction = null;
    }

    // На отличие от onPointerUp: жест прерван (OS-жест, потеря указателя), а не
    // завершён игроком — незафиксированный штрих откатывается, а не засчитывается.
    onPointerCancel(e) {
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      this.pointers.delete(e.pointerId);

      if (this.gestureActive && this.gestureIds.includes(e.pointerId)) {
        this.gestureActive = false; this.gestureIds = [];
        return;
      }
      if (this.strokeActive && e.pointerId === this.strokePointerId) {
        this.cancelLongPress();
        this.strokeActive = false;
        this.renderer.clearDrawingLine();
        if (this.strokeChanges.length && this.game) {
          this.game.revertLive(this.strokeChanges);
          this.cb.onUpdate();
        }
        this.strokeChanges = [];
        this.strokeAction = null;
      }
    }

    fireLongPress() {
      this.longPressTimer = null;
      if (!this.strokeActive || !this.game || this.game.solved) return;
      const cell = this.strokeStartCell;
      if (!this.renderer.inBounds(cell)) return;
      this.longPressFired = true;
      const { changes } = this.game.resolveCellForAction('setX', cell.r, cell.c);
      for (const ch of changes) this.game.applyLive(ch);
      if (changes.length) {
        this.game.finalizeStroke(changes);
        SoundManager.x(); Haptics.x();
        this.cb.onUpdate();
        if (!this.game.solved && this.game.isSolved()) this.cb.onWin();
      }
    }

    // ---------- штрих ----------

    extendStroke(toCell) {
      const from = this.strokeLastCell || this.strokeStartCell;
      const cells = [];
      if (from.r === toCell.r) {
        const step = toCell.c >= from.c ? 1 : -1;
        for (let c = from.c; ; c += step) { cells.push({ r: from.r, c }); if (c === toCell.c) break; }
      } else if (from.c === toCell.c) {
        const step = toCell.r >= from.r ? 1 : -1;
        for (let r = from.r; ; r += step) { cells.push({ r, c: from.c }); if (r === toCell.r) break; }
      } else {
        cells.push(toCell);
      }
      this.strokeLastCell = toCell;
      this.processCells(cells);
    }

    // Применяет действие к новым клеткам штриха. Действие резолвится один раз —
    // по самой первой клетке — и переиспользуется до конца штриха.
    processCells(cells) {
      if (!this.game || this.game.solved) return;
      const newly = [];
      for (const { r, c } of cells) {
        const key = r + ',' + c;
        if (this.strokeTouched.has(key)) continue;
        this.strokeTouched.add(key);
        newly.push({ r, c });
      }
      if (!newly.length) return;

      if (this.strokeAction === null) {
        this.strokeAction = this.game.resolveStrokeAction(this.mode, newly[0].r, newly[0].c);
      }
      if (!this.strokeAction) return;

      const errorCells = [];
      for (const { r, c } of newly) {
        const { changes, isError } = this.game.resolveCellForAction(this.strokeAction, r, c);
        for (const ch of changes) { this.game.applyLive(ch); this.strokeChanges.push(ch); }
        if (isError) errorCells.push([r, c]);
      }

      this.renderer.setDrawingLine(newly);
      this.playStrokeSound();
      if (errorCells.length) {
        this.game.errors += errorCells.length;
        this.renderer.setErrorFlash(errorCells);
        this.cb.onError();
      } else {
        this.cb.onUpdate();
      }

      if (!this.game.solved && this.game.isSolved()) {
        this.game.finalizeStroke(this.strokeChanges);
        this.strokeChanges = [];
        this.strokeActive = false;
        this.cb.onWin();
      }
    }

    playStrokeSound() {
      if (this.strokeAction === 'fill' || this.strokeAction === 'erase') { SoundManager.paint(); Haptics.paint(); }
      else if (this.strokeAction === 'setX' || this.strokeAction === 'removeX') { SoundManager.x(); Haptics.x(); }
      else if (this.strokeAction === 'setMemo' || this.strokeAction === 'removeMemo') { SoundManager.memo(); Haptics.memo(); }
    }

    // ---------- зум / панорама ----------

    beginGesture() {
      this.cancelLongPress();
      if (this.strokeActive && this.strokeChanges.length) {
        this.game.revertLive(this.strokeChanges);
        this.cb.onUpdate();
      }
      this.strokeActive = false;
      this.strokeChanges = [];
      this.renderer.clearDrawingLine();

      const ids = [...this.pointers.keys()].slice(0, 2);
      const p1 = this.pointers.get(ids[0]), p2 = this.pointers.get(ids[1]);
      this.gestureActive = true;
      this.gestureIds = ids;
      this.gestureStart = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        zoom: this.renderer.zoom, panX: this.renderer.panX, panY: this.renderer.panY
      };
    }

    updateGesture() {
      const p1 = this.pointers.get(this.gestureIds[0]), p2 = this.pointers.get(this.gestureIds[1]);
      if (!p1 || !p2) return;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const newZoom = this.gestureStart.zoom * (dist / this.gestureStart.dist);

      this.renderer.zoom = this.gestureStart.zoom;
      this.renderer.panX = this.gestureStart.panX;
      this.renderer.panY = this.gestureStart.panY;
      this.renderer.zoomAt(this.gestureStart.center.x, this.gestureStart.center.y, newZoom);
      this.renderer.panBy(center.x - this.gestureStart.center.x, center.y - this.gestureStart.center.y);
    }

    onWheel(e) {
      if (!this.game) return;
      e.preventDefault();
      const p = this.getCanvasCoords(e);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.renderer.zoomBy(factor, p.x, p.y);
    }

    toggleZoom(x, y) {
      if (this.renderer.isFit()) this.renderer.zoomAt(x, y, Math.min(2.5, this.renderer.maxZoom));
      else this.renderer.zoomFit();
    }

    // ---------- клавиатура ----------

    moveCursor(dr, dc) {
      if (!this.game) return;
      const size = this.game.size;
      const cur = this.renderer.cursorCell || this.renderer.hoverCell || { r: (size / 2) | 0, c: (size / 2) | 0 };
      const next = { r: Math.max(0, Math.min(size - 1, cur.r + dr)), c: Math.max(0, Math.min(size - 1, cur.c + dc)) };
      this.renderer.setCursorCell(next);
      this.ensureCellVisible(next);
    }

    activateCursor() {
      if (!this.game || !this.renderer.cursorCell || this.game.solved) return;
      this.strokeAction = null;
      this.strokeTouched = new Set();
      this.strokeChanges = [];
      this.processCells([this.renderer.cursorCell]);
      if (this.strokeChanges.length) this.game.finalizeStroke(this.strokeChanges);
      this.strokeChanges = [];
    }

    ensureCellVisible(cell) {
      if (this.renderer.isFit()) return;
      const cellPx = this.renderer.effectiveCell();
      const origin = this.renderer.getBoardOrigin();
      const vp = this.renderer.boardViewport();
      const x = origin.x + cell.c * cellPx, y = origin.y + cell.r * cellPx;
      let dx = 0, dy = 0;
      if (x < vp.x) dx = vp.x - x;
      else if (x + cellPx > vp.x + vp.w) dx = (vp.x + vp.w) - (x + cellPx);
      if (y < vp.y) dy = vp.y - y;
      else if (y + cellPx > vp.y + vp.h) dy = (vp.y + vp.h) - (y + cellPx);
      if (dx || dy) this.renderer.panBy(dx, dy);
    }
  }
