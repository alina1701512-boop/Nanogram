  // ===================== GAME STATE =====================
  export class GameState {
    constructor(solution) {
      this.solution = solution;
      this.size = solution.length;
      this.grid = Array(this.size).fill().map(() => Array(this.size).fill(0));
      this.memoGrid = Array(this.size).fill().map(() => Array(this.size).fill(0));
      // Отметка «этот крестик поставила игра, а не игрок»: только такие крестики
      // можно снимать обратно, когда линия перестаёт быть решённой.
      this.autoX = Array(this.size).fill().map(() => Array(this.size).fill(0));
      this.hintCells = new Set();
      this.solvedLines = { rows: new Set(), cols: new Set() };
      this.errors = 0;
      this.hintsUsed = 0;
      this.history = [];
      this.redoStack = [];
      this.solved = false;
      this.lineAnimations = [];
      // Время копится в elapsed, а runningSince хранит момент запуска.
      // Так таймер можно честно остановить на паузе.
      this.elapsed = 0;
      this.runningSince = null;
    }

    // ---------- часы ----------
    startClock() { if (this.runningSince === null && !this.solved) this.runningSince = Date.now(); }
    stopClock() {
      if (this.runningSince !== null) {
        this.elapsed += Date.now() - this.runningSince;
        this.runningSince = null;
      }
    }
    time() { return this.elapsed + (this.runningSince === null ? 0 : Date.now() - this.runningSince); }

    getCell(r, c) { return this.grid[r][c]; }
    getMemo(r, c) { return this.memoGrid[r][c]; }

    getLineHints(line) {
      const hints = [];
      let count = 0;
      for (const v of line) {
        if (v === 1) count++;
        else { if (count > 0) hints.push(count); count = 0; }
      }
      if (count > 0) hints.push(count);
      return hints.length ? hints : [0];
    }

    getRowHints(r) { return this.getLineHints(this.solution[r]); }
    getColHints(c) {
      const col = [];
      for (let r = 0; r < this.size; r++) col.push(this.solution[r][c]);
      return this.getLineHints(col);
    }

    // Линия считается закрытой, если раскладка закрашенных клеток даёт те же
    // числа-подсказки — а не если она побайтово совпадает с сохранённым
    // решением. Разница не видна, пока у кроссворда одно решение (мы теперь
    // проверяем это решателем при сборке коллекции), но так честнее: игрока
    // не накажет альтернативная, но тоже верная раскладка.
    lineMatchesSolution(lineType, index) {
      const hints = lineType === 'row' ? this.getRowHints(index) : this.getColHints(index);
      const playerLine = lineType === 'row' ? this.grid[index] : this.grid.map(row => row[index]);
      const playerHints = this.getLineHints(playerLine.map(v => v === 1 ? 1 : 0));
      if (playerHints.length !== hints.length) return false;
      for (let i = 0; i < hints.length; i++) if (playerHints[i] !== hints[i]) return false;
      return true;
    }

    // ---------- изменения поля ----------
    // Любая правка описывается записью {r, c, layer, prev, next}, ход в истории —
    // массив таких записей. Раньше часть изменений (авто-крестики, сброс memo при
    // постановке крестика) шла мимо истории, и отмена возвращала поле не полностью.

    change(r, c, next, layer = 'grid') {
      const prev = layer === 'memo' ? this.memoGrid[r][c] : this.grid[r][c];
      return prev === next ? null : { r, c, layer, prev, next };
    }

    applyChanges(changes, direction) {
      for (const ch of changes) {
        const val = direction === 'next' ? ch.next : ch.prev;
        if (ch.layer === 'memo') {
          this.memoGrid[ch.r][ch.c] = val;
        } else {
          this.grid[ch.r][ch.c] = val;
          this.autoX[ch.r][ch.c] = 0;
          if (val === 1) this.hintCells.delete(`${ch.r},${ch.c}`);
        }
      }
    }

    commit(changes) {
      const list = changes.filter(Boolean);
      if (!list.length) return false;
      this.applyChanges(list, 'next');
      this.history.push(list);
      if (this.history.length > 300) this.history.shift();
      this.redoStack = [];
      this.checkSolvedLines();
      return true;
    }

    setCell(r, c, val) { return this.commit([this.change(r, c, val)]); }
    setMemo(r, c, val) { return this.commit([this.change(r, c, val, 'memo')]); }

    // ---------- штрих: действие определяется один раз по первой клетке ----------
    // Свайп ведёт себя как один ход, а не как N независимых тапов: тап по первой
    // клетке решает, закрашиваем мы линию или стираем (в режиме крестика — ставим
    // или снимаем, в режиме memo — пишем или стираем), и это решение не меняется
    // до конца штриха, даже если палец проедет по уже закрашенным клеткам.
    resolveStrokeAction(mode, r, c) {
      if (mode === 'paint') return this.grid[r][c] === 1 ? 'erase' : 'fill';
      if (mode === 'x') return this.grid[r][c] === 2 ? 'removeX' : 'setX';
      if (mode === 'memo') return this.memoGrid[r][c] > 0 ? 'removeMemo' : 'setMemo';
      return null;
    }

    // Изменения для одной клетки под уже выбранное действие. Неверная клетка при
    // закраске не остаётся чёрной — сразу становится крестиком: поле всегда
    // согласовано с тем, что показывает счётчик ошибок, и кроссворд всегда можно
    // дорешать до конца, не разыскивая на поле свою же ошибку.
    resolveCellForAction(action, r, c) {
      const changes = [];
      let isError = false;
      if (action === 'fill') {
        const correct = this.solution[r][c] === 1;
        const ch = this.change(r, c, correct ? 1 : 2);
        if (ch) { changes.push(ch); isError = !correct; }
      } else if (action === 'erase') {
        if (this.grid[r][c] === 1) { const ch = this.change(r, c, 0); if (ch) changes.push(ch); }
      } else if (action === 'setX') {
        const ch = this.change(r, c, 2);
        if (ch) changes.push(ch);
        if (this.memoGrid[r][c] !== 0) { const m = this.change(r, c, 0, 'memo'); if (m) changes.push(m); }
      } else if (action === 'removeX') {
        if (this.grid[r][c] === 2) { const ch = this.change(r, c, 0); if (ch) changes.push(ch); }
      } else if (action === 'setMemo') {
        const ch = this.change(r, c, 1, 'memo');
        if (ch) changes.push(ch);
      } else if (action === 'removeMemo') {
        const ch = this.change(r, c, 0, 'memo');
        if (ch) changes.push(ch);
      }
      return { changes, isError };
    }

    // Применяет изменение сразу (для живой отрисовки штриха под пальцем), не трогая
    // историю — весь штрих ложится в историю одной записью через finalizeStroke.
    applyLive(ch) {
      this.applyChanges([ch], 'next');
      this.checkSolvedLines();
    }

    // Откатывает ещё не зафиксированный штрих — например, когда во время рисования
    // опустился второй палец и жест распознан как зум/панорама, а не как рисование.
    revertLive(changes) {
      if (!changes.length) return;
      this.applyChanges(changes, 'prev');
      this.checkSolvedLines();
    }

    // Кладёт уже применённые через applyLive изменения в историю одной записью —
    // отмена уберёт весь штрих целиком, а не по клетке за раз.
    finalizeStroke(changes) {
      if (!changes.length) return false;
      this.history.push(changes);
      if (this.history.length > 300) this.history.shift();
      this.redoStack = [];
      return true;
    }

    clearAllMemos() {
      const changes = [];
      for (let r = 0; r < this.size; r++)
        for (let c = 0; c < this.size; c++)
          if (this.memoGrid[r][c] !== 0) changes.push(this.change(r, c, 0, 'memo'));
      return this.commit(changes);
    }

    hasMemos() {
      for (let r = 0; r < this.size; r++)
        for (let c = 0; c < this.size; c++)
          if (this.memoGrid[r][c] > 0) return true;
      return false;
    }

    addHint(r, c) { this.hintCells.add(`${r},${c}`); }
    hasHint(r, c) { return this.hintCells.has(`${r},${c}`); }

    checkSolvedLines() {
      const now = Date.now();
      for (let r = 0; r < this.size; r++) {
        const solved = this.lineMatchesSolution('row', r);
        if (solved && !this.solvedLines.rows.has(r)) this.lineAnimations.push({ type: 'row', index: r, start: now });
        if (solved) this.solvedLines.rows.add(r); else this.solvedLines.rows.delete(r);
      }
      for (let c = 0; c < this.size; c++) {
        const solved = this.lineMatchesSolution('col', c);
        if (solved && !this.solvedLines.cols.has(c)) this.lineAnimations.push({ type: 'col', index: c, start: now });
        if (solved) this.solvedLines.cols.add(c); else this.solvedLines.cols.delete(c);
      }
      this.syncAutoCross();
    }

    // Расставляет и снимает автоматические крестики. Снятие — новое:
    // раньше крестики, поставленные закрытой линией, оставались на поле навсегда.
    syncAutoCross() {
      for (let r = 0; r < this.size; r++) {
        const rowSolved = this.solvedLines.rows.has(r);
        for (let c = 0; c < this.size; c++) {
          const covered = rowSolved || this.solvedLines.cols.has(c);
          if (covered && this.grid[r][c] === 0 && this.solution[r][c] === 0) {
            this.grid[r][c] = 2;
            this.autoX[r][c] = 1;
          } else if (!covered && this.autoX[r][c]) {
            if (this.grid[r][c] === 2) this.grid[r][c] = 0;
            this.autoX[r][c] = 0;
          }
        }
      }
    }

    getProgress() {
      let correct = 0, total = 0;
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.solution[r][c] === 1) {
            total++;
            if (this.grid[r][c] === 1) correct++;
          }
        }
      }
      return { correct, total, percent: total > 0 ? correct / total : 0 };
    }

    undo() {
      if (!this.history.length) return false;
      const changes = this.history.pop();
      this.applyChanges(changes, 'prev');
      this.redoStack.push(changes);
      this.checkSolvedLines();
      return true;
    }

    redo() {
      if (!this.redoStack.length) return false;
      const changes = this.redoStack.pop();
      this.applyChanges(changes, 'next');
      this.history.push(changes);
      this.checkSolvedLines();
      return true;
    }

    reset() {
      this.grid = Array(this.size).fill().map(() => Array(this.size).fill(0));
      this.memoGrid = Array(this.size).fill().map(() => Array(this.size).fill(0));
      this.autoX = Array(this.size).fill().map(() => Array(this.size).fill(0));
      this.hintCells.clear();
      this.solvedLines.rows.clear();
      this.solvedLines.cols.clear();
      this.lineAnimations = [];
      this.history = [];
      this.redoStack = [];
      this.errors = 0;
      this.hintsUsed = 0;
      this.solved = false;
    }

    isSolved() {
      for (let r = 0; r < this.size; r++)
        for (let c = 0; c < this.size; c++) {
          if (this.solution[r][c] === 1 && this.grid[r][c] !== 1) return false;
          if (this.solution[r][c] === 0 && this.grid[r][c] === 1) return false;
        }
      return true;
    }
  }
