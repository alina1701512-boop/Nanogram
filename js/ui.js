import { SoundManager } from './sound.js';
import { Haptics } from './haptics.js';
import { Confetti } from './confetti.js';
import { Palette } from './palette.js';
import { Storage } from './storage.js';
import { GameState } from './game-state.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input-handler.js';
import { PUZZLES, puzzleSolutions } from './puzzles.js';

  // ===================== UI =====================
  export const UI = {
    game: null, renderer: null, inputHandler: null,
    currentPuzzleIndex: 0, saveTimeout: null, timerInterval: null,
    currentFilter: 'all', confirmCallback: null,

    init() {
      try {
        SoundManager.init();
        Confetti.init();
        this.renderer = new Renderer(document.getElementById('game-canvas'));
        this.loadSettings();
        Palette.refresh();
        // Обработчик ввода создаётся один раз на весь сеанс, дальше ему
        // подсовывается новая партия через setGame.
        this.inputHandler = new InputHandler(this.renderer, {
          onUpdate: () => {
            this.renderer.draw();
            this.updateMemoButton();
            this.updateProgress();
            this.updateStats();
            this.debouncedSave();
          },
          onError: () => {
            this.updateStats();
            this.debouncedSave();
            const app = document.getElementById('app');
            app.classList.remove('shake');
            void app.offsetWidth;
            app.classList.add('shake');
          },
          onWin: () => this.winPuzzle(),
          onMemoChange: () => {
            this.updateMemoButton();
            this.debouncedSave();
          }
        });
        this.inputHandler.setLongPress(Storage.get('longPressEnabled', true));
        this.bindEvents();
        this.showPuzzleSelector();
        const seen = Storage.get('tutorialSeen', false);
        if (!seen) setTimeout(() => this.showModal('modal-tutorial'), 500);
        const lastIdx = Storage.get('lastPuzzleIndex', 0);
        this.loadPuzzle(lastIdx);
      } catch (error) { console.error('Init error:', error); }
    },

    loadSettings() {
      const theme = Storage.get('theme', 'dark');
      document.documentElement.setAttribute('data-theme', theme);
      document.getElementById('switch-theme').classList.toggle('on', theme === 'dark');
      SoundManager.enabled = Storage.get('soundEnabled', true);
      document.getElementById('switch-sound').classList.toggle('on', SoundManager.enabled);
      Haptics.enabled = Storage.get('hapticEnabled', true);
      document.getElementById('switch-haptic').classList.toggle('on', Haptics.enabled);
      const longPress = Storage.get('longPressEnabled', true);
      document.getElementById('switch-longpress').classList.toggle('on', longPress);
    },

    bindEvents() {
      document.getElementById('btn-menu').onclick = () => this.showModal('modal-puzzles');
      document.getElementById('btn-puzzles').onclick = () => this.showModal('modal-puzzles');
      document.getElementById('btn-settings').onclick = () => this.showModal('modal-settings');
      document.getElementById('btn-undo').onclick = () => this.undo();
      document.getElementById('btn-redo').onclick = () => this.redo();
      document.getElementById('btn-zoom-in').onclick = () => this.zoomStep(1.4);
      document.getElementById('btn-zoom-out').onclick = () => this.zoomStep(1 / 1.4);
      document.getElementById('btn-zoom-fit').onclick = () => this.zoomFit();
      document.getElementById('btn-clear').onclick = () => this.confirmClear();
      document.getElementById('btn-clear-memo').onclick = () => this.clearMemos();
      document.getElementById('btn-hint').onclick = () => this.giveHint();

      document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.onclick = e => {
          const mode = e.currentTarget.dataset.mode;
          if (!this.inputHandler) return;
          this.inputHandler.setMode(mode);
          document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          SoundManager.mode(); Haptics.mode();
        };
      });

      document.querySelectorAll('[data-close]').forEach(btn => {
        btn.onclick = () => this.hideModal(btn.dataset.close);
      });

      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.onclick = e => { if (e.target === overlay) this.hideModal(overlay.id); };
      });

      document.getElementById('switch-theme').onclick = (e) => {
        const sw = e.currentTarget;
        sw.classList.toggle('on');
        const isDark = sw.classList.contains('on');
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        Storage.set('theme', isDark ? 'dark' : 'light');
        Palette.refresh();
        if (this.renderer) this.renderer.draw();
        this.showPuzzleSelector();
      };

      document.getElementById('switch-sound').onclick = (e) => {
        const sw = e.currentTarget;
        sw.classList.toggle('on');
        SoundManager.enabled = sw.classList.contains('on');
        Storage.set('soundEnabled', SoundManager.enabled);
      };

      document.getElementById('switch-haptic').onclick = (e) => {
        const sw = e.currentTarget;
        sw.classList.toggle('on');
        Haptics.enabled = sw.classList.contains('on');
        Storage.set('hapticEnabled', Haptics.enabled);
      };

      document.getElementById('switch-longpress').onclick = (e) => {
        const sw = e.currentTarget;
        sw.classList.toggle('on');
        const enabled = sw.classList.contains('on');
        Storage.set('longPressEnabled', enabled);
        if (this.inputHandler) this.inputHandler.setLongPress(enabled);
      };

      document.getElementById('btn-tutorial').onclick = () => {
        this.hideModal('modal-settings');
        setTimeout(() => this.showModal('modal-tutorial'), 200);
      };

      document.getElementById('btn-export').onclick = () => this.exportProgress();
      document.getElementById('btn-import').onclick = () => this.importProgress();
      document.getElementById('btn-reset-all').onclick = () => this.confirmResetAll();

      document.getElementById('btn-next-puzzle').onclick = () => {
        this.hideModal('modal-win');
        this.loadPuzzle(this.findNextUnsolved());
      };
      document.getElementById('btn-all-puzzles').onclick = () => {
        this.hideModal('modal-win');
        this.showModal('modal-puzzles');
      };
      document.getElementById('btn-restart').onclick = () => {
        this.hideModal('modal-win');
        // Не loadPuzzle() — он подтянул бы из сохранения solved:true и полностью
        // закрашенное поле, и повторная попытка была бы невозможна: открылась бы
        // уже решённая головоломка, по которой нечего делать. clearPuzzle держит
        // ту же партию в памяти и просто обнуляет её, включая часы и hintsUsed.
        this.clearPuzzle();
      };

      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentFilter = btn.dataset.filter;
          this.showPuzzleSelector();
        };
      });

      document.getElementById('confirm-yes').onclick = () => {
        this.hideModal('modal-confirm');
        if (this.confirmCallback) this.confirmCallback();
        this.confirmCallback = null;
      };

      window.addEventListener('keydown', e => {
        if (document.querySelector('.modal-overlay.show')) return;
        if (e.key === '1') this.setMode('paint');
        else if (e.key === '2') this.setMode('x');
        else if (e.key === '3') this.setMode('memo');
        else if (e.key === 'z' || e.key === 'Z') this.undo();
        else if (e.key === 'y' || e.key === 'Y') this.redo();
        else if (e.key === 'h' || e.key === 'H') this.giveHint();
        else if (e.key === '+' || e.key === '=') this.zoomStep(1.3);
        else if (e.key === '-' || e.key === '_') this.zoomStep(1 / 1.3);
        else if (e.key === '0') this.zoomFit();
        else if (!this.inputHandler) return;
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.inputHandler.moveCursor(-1, 0); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this.inputHandler.moveCursor(1, 0); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.inputHandler.moveCursor(0, -1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.inputHandler.moveCursor(0, 1); }
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.inputHandler.activateCursor(); }
        else return;
        this.renderer.draw();
      });

      window.addEventListener('resize', () => {
        if (this.renderer && this.game) {
          this.renderer.computeSizes();
          this.renderer.draw();
        }
        Confetti.resize();
      });

      const animate = () => {
        if (this.game && this.renderer) {
          // Просроченные анимации убираются здесь, а не в обработчике хода.
          // Раньше массив чистился только при изменении клетки — после последней
          // закрытой линии он оставался непустым, и перерисовка шла вечно.
          if (this.game.lineAnimations.length) {
            const now = Date.now();
            this.game.lineAnimations = this.game.lineAnimations.filter(a => now - a.start < 800);
          }
          // Кадр перерисовывается по флагу «что-то изменилось» (жест зума/панорамы,
          // мигание ошибки, подсказка, закрытие линии), а не непрерывно.
          if (this.renderer.hasLiveAnimation()) this.renderer.markDirty();
          if (this.renderer.dirty) this.renderer.draw();
        }
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);

      // Таймер не должен идти, пока игру не видно.
      document.addEventListener('visibilitychange', () => {
        if (!this.game) return;
        if (document.hidden) this.game.stopClock();
        else if (!document.querySelector('.modal-overlay.show')) this.game.startClock();
        this.debouncedSave();
      });

      document.body.addEventListener('pointerdown', () => SoundManager.resume(), { once: true });
    },

    // Зум к центру видимой области поля — используется кнопками и клавишами +/-.
    zoomStep(factor) {
      if (!this.renderer || !this.renderer.state) return;
      const vp = this.renderer.boardViewport();
      this.renderer.zoomBy(factor, vp.x + vp.w / 2, vp.y + vp.h / 2);
      this.renderer.draw();
    },

    zoomFit() {
      if (!this.renderer) return;
      this.renderer.zoomFit();
      this.renderer.draw();
    },

    setMode(mode) {
      if (!this.inputHandler) return;
      this.inputHandler.setMode(mode);
      document.querySelectorAll('[data-mode]').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      SoundManager.mode(); Haptics.mode();
    },

    showModal(id) {
      if (id === 'modal-puzzles') this.showPuzzleSelector();
      document.getElementById(id).classList.add('show');
      if (this.game) { this.game.stopClock(); this.debouncedSave(); }
    },

    hideModal(id) {
      document.getElementById(id).classList.remove('show');
      // Часы возобновляются, только когда закрылось последнее окно.
      if (this.game && !document.querySelector('.modal-overlay.show') && !document.hidden) {
        this.game.startClock();
      }
    },

    notify(title, text) {
      document.getElementById('notice-title').textContent = title;
      document.getElementById('notice-text').textContent = text;
      this.showModal('modal-notice');
    },

    loadPuzzle(index) {
      this.currentPuzzleIndex = index;
      Storage.set('lastPuzzleIndex', index);
      const solution = puzzleSolutions[index];
      this.game = new GameState(solution);
      this.game.puzzleName = PUZZLES[index].name;
      this.game.puzzleSize = PUZZLES[index].size;

      const progress = Storage.get('puzzleProgress', {});
      const saved = progress && typeof progress === 'object' ? progress[index] : null;
      if (saved && typeof saved === 'object') {
        // Сохранение принимается, только если оно подходит этому кроссворду.
        // Иначе битый или устаревший файл ронял отрисовку при каждом запуске.
        const sig = Storage.signature(solution);
        if (saved.sig === undefined || saved.sig === sig) {
          const grid = Storage.decodeGrid(saved.grid);
          if (Storage.isValidGrid(grid, this.game.size)) this.game.grid = grid;
          const memo = Storage.decodeGrid(saved.memoGrid);
          if (Storage.isValidGrid(memo, this.game.size)) this.game.memoGrid = memo;
        }
        if (Number.isFinite(saved.errors) && saved.errors >= 0) this.game.errors = Math.floor(saved.errors);
        if (Number.isFinite(saved.elapsed) && saved.elapsed >= 0) this.game.elapsed = Math.floor(saved.elapsed);
        if (saved.solved === true) this.game.solved = true;
        this.game.checkSolvedLines();
      }

      this.renderer.setState(this.game);
      this.inputHandler.setGame(this.game);
      this.inputHandler.setLongPress(Storage.get('longPressEnabled', true));

      this.renderer.draw();
      this.updateTitle();
      this.startTimer();
      this.updateStats();
      this.updateMemoButton();
      this.updateProgress();
    },

    debouncedSave() {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => this.saveProgress(), 500);
    },

    updateTitle() {
      document.getElementById('puzzle-title').textContent =
        `${this.game.puzzleName} · ${this.game.puzzleSize}×${this.game.puzzleSize}`;
    },
    updateStats() { document.getElementById('error-count').textContent = `✕ ${this.game.errors}`; },
    updateProgress() {
      const prog = this.game.getProgress();
      document.getElementById('progress-bar').style.width = (prog.percent * 100) + '%';
    },
    updateMemoButton() {
      const btn = document.getElementById('btn-clear-memo');
      btn.style.display = this.game && this.game.hasMemos() ? 'flex' : 'none';
    },

    startTimer() {
      if (this.timerInterval) clearInterval(this.timerInterval);
      if (this.game && !document.querySelector('.modal-overlay.show') && !document.hidden) {
        this.game.startClock();
      }
      const update = () => {
        if (!this.game) return;
        document.getElementById('timer').textContent = '⏱ ' + this.formatTime(this.game.time());
      };
      update();
      this.timerInterval = setInterval(update, 1000);
    },

    // 3 звезды за решение без ошибок и без подсказок, минус звезда за каждое,
    // но не меньше одной — кроссворд один раз решён, это уже что-то.
    computeStars() {
      let stars = 3;
      if (this.game.errors > 0) stars--;
      if (this.game.hintsUsed > 0) stars--;
      return Math.max(1, stars);
    },

    starsHtml(n) {
      let out = '';
      for (let i = 1; i <= 3; i++) out += i <= n ? '★' : '☆';
      return out;
    },

    winPuzzle() {
      this.game.solved = true;
      this.game.stopClock();
      SoundManager.win(); Haptics.win(); Confetti.spawn();

      const elapsed = this.game.time();
      const newStars = this.computeStars();
      const progress = Storage.get('puzzleProgress', {});
      const prev = progress[this.currentPuzzleIndex];
      const stars = Math.max(newStars, (prev && prev.stars) || 0);
      const isRecord = prev && Number.isFinite(prev.bestTime) && elapsed < prev.bestTime;
      const bestTime = isRecord ? elapsed : (prev && prev.bestTime) || elapsed;
      this.saveProgress(true, { stars, bestTime });

      document.getElementById('win-stats').innerHTML = `
        <p style="font-size: 16px; margin: 12px 0;">
          <strong>${this.game.puzzleName}</strong> · ${this.game.puzzleSize}×${this.game.puzzleSize}
        </p>
        <p style="font-size: 22px; letter-spacing: 2px; color: #ffd700;">${this.starsHtml(newStars)}</p>
        <p>⏱ Время: <strong>${this.formatTime(elapsed)}</strong>${isRecord ? ' · 🏆 новый рекорд' : ''}</p>
        <p>✕ Ошибки: <strong>${this.game.errors}</strong>${this.game.hintsUsed ? ` · 💡 Подсказок: <strong>${this.game.hintsUsed}</strong>` : ''}</p>
      `;
      setTimeout(() => this.showModal('modal-win'), 500);
    },

    formatTime(ms) {
      const s = Math.floor(ms / 1000);
      return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    },

    // extra позволяет явно задать stars/bestTime (при победе); в остальных
    // случаях они переносятся из уже сохранённого прогресса без изменений.
    saveProgress(solved = false, extra = {}) {
      const progress = Storage.get('puzzleProgress', {});
      const prev = progress[this.currentPuzzleIndex] || {};
      progress[this.currentPuzzleIndex] = {
        solved: solved || this.game.solved,
        grid: Storage.encodeGrid(this.game.grid),
        memoGrid: Storage.encodeGrid(this.game.memoGrid),
        errors: this.game.errors,
        elapsed: this.game.time(),
        sig: Storage.signature(this.game.solution),
        stars: extra.stars !== undefined ? extra.stars : prev.stars,
        bestTime: extra.bestTime !== undefined ? extra.bestTime : prev.bestTime
      };
      Storage.set('puzzleProgress', progress);
    },

    undo() { this.afterHistoryStep(this.game && this.game.undo()); },
    redo() { this.afterHistoryStep(this.game && this.game.redo()); },

    afterHistoryStep(changed) {
      if (!changed) return;
      this.renderer.draw();
      this.updateMemoButton(); this.updateProgress(); this.updateStats();
      this.debouncedSave();
      SoundManager.mode();
      // Повтор хода может оказаться последним — победу надо засчитать сразу,
      // а не ждать, пока игрок ещё раз тронет поле.
      if (!this.game.solved && this.game.isSolved()) this.winPuzzle();
    },

    confirmClear() {
      if (!this.game) return;
      document.getElementById('confirm-title').textContent = '🗑 Очистить поле?';
      document.getElementById('confirm-text').textContent = 'Все закрашенные клетки и memo будут удалены.';
      this.confirmCallback = () => this.clearPuzzle();
      this.showModal('modal-confirm');
    },

    clearPuzzle() {
      if (!this.game) return;
      // Сбрасывается и счётчик ошибок, и признак решённости — раньше они
      // оставались от прошлой попытки на пустом поле.
      this.game.reset();
      this.renderer.draw();
      this.updateMemoButton(); this.updateProgress(); this.updateStats();
      this.startTimer();
      this.debouncedSave();
    },

    clearMemos() {
      if (this.game) {
        this.game.clearAllMemos();
        this.renderer.draw();
        this.updateMemoButton();
        this.debouncedSave();
      }
    },

    giveHint() {
      if (!this.game || this.game.solved) return;
      const unsolved = [];
      for (let r = 0; r < this.game.size; r++)
        for (let c = 0; c < this.game.size; c++)
          if (this.game.solution[r][c] === 1 && this.game.grid[r][c] !== 1 && !this.game.hasHint(r, c))
            unsolved.push([r, c]);
      if (unsolved.length) {
        const [r, c] = unsolved[Math.floor(Math.random() * unsolved.length)];
        this.game.addHint(r, c);
        this.game.hintsUsed++;
        this.renderer.draw();
        Haptics.tap(); SoundManager.tap();
      }
    },

    findNextUnsolved() {
      const progress = Storage.get('puzzleProgress', {});
      for (let i = 1; i <= PUZZLES.length; i++) {
        const idx = (this.currentPuzzleIndex + i) % PUZZLES.length;
        if (!progress[idx]?.solved) return idx;
      }
      return (this.currentPuzzleIndex + 1) % PUZZLES.length;
    },

    buildPuzzleCard(puzzle, index, entry) {
      const isSolved = entry?.solved || false;
      const card = document.createElement('div');
      card.className = 'puzzle-card' + (isSolved ? ' solved' : '');
      const preview = document.createElement('canvas');
      const previewSize = 120;
      preview.width = previewSize;
      preview.height = previewSize;
      this.drawPreview(preview, puzzleSolutions[index]);
      card.appendChild(preview);
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = puzzle.name;
      card.appendChild(name);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${puzzle.size}×${puzzle.size} · ${puzzle.difficulty}`;
      card.appendChild(meta);
      if (isSolved) {
        const stats = document.createElement('div');
        stats.className = 'meta';
        const time = Number.isFinite(entry.bestTime) ? this.formatTime(entry.bestTime) : '';
        stats.textContent = `${this.starsHtml(entry.stars || 0)}${time ? ' · ⏱ ' + time : ''}`;
        card.appendChild(stats);
      }
      card.onclick = () => {
        this.hideModal('modal-puzzles');
        this.loadPuzzle(index);
      };
      return card;
    },

    puzzleMatchesFilter(puzzle, isSolved) {
      if (this.currentFilter === 'solved') return isSolved;
      if (this.currentFilter === 'unsolved') return !isSolved;
      if (this.currentFilter.startsWith('diff:')) return puzzle.difficulty === this.currentFilter.slice(5);
      if (this.currentFilter.startsWith('pack:')) return puzzle.pack === this.currentFilter.slice(5);
      return true; // 'all'
    },

    showPuzzleSelector() {
      const grid = document.getElementById('puzzles-grid');
      grid.innerHTML = '';
      const progress = Storage.get('puzzleProgress', {});

      const solvedCount = PUZZLES.reduce((n, _, i) => n + (progress[i]?.solved ? 1 : 0), 0);
      const totalStars = PUZZLES.reduce((n, _, i) => n + (progress[i]?.stars || 0), 0);
      const progressEl = document.getElementById('collection-progress');
      if (progressEl) {
        progressEl.textContent = `Решено: ${solvedCount}/${PUZZLES.length} · ★ ${totalStars}/${PUZZLES.length * 3}`;
      }

      // На «Все» кроссворды показываются главами по пакам — так же, как их
      // задумывали собирать; любой другой фильтр даёт обычную плоскую сетку.
      if (this.currentFilter === 'all') {
        const packs = [...new Set(PUZZLES.map(p => p.pack))];
        for (const pack of packs) {
          const items = PUZZLES.map((p, i) => [p, i]).filter(([p]) => p.pack === pack);
          if (!items.length) continue;
          const header = document.createElement('div');
          header.className = 'pack-header';
          header.textContent = pack;
          grid.appendChild(header);
          for (const [puzzle, index] of items) {
            grid.appendChild(this.buildPuzzleCard(puzzle, index, progress[index]));
          }
        }
        return;
      }

      PUZZLES.forEach((puzzle, index) => {
        const entry = progress[index];
        const isSolved = entry?.solved || false;
        if (!this.puzzleMatchesFilter(puzzle, isSolved)) return;
        grid.appendChild(this.buildPuzzleCard(puzzle, index, entry));
      });
    },

    drawPreview(canvas, solution) {
      const ctx = canvas.getContext('2d');
      const size = solution.length;
      const cell = canvas.width / size;
      ctx.fillStyle = Palette.get('--color-cell-bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = Palette.get('--color-fill');
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (solution[r][c] === 1) ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
    },

    exportProgress() {
      const data = {
        version: 1,
        exported: new Date().toISOString(),
        puzzleProgress: Storage.get('puzzleProgress', {}),
        settings: {
          theme: Storage.get('theme', 'dark'),
          soundEnabled: Storage.get('soundEnabled', true),
          hapticEnabled: Storage.get('hapticEnabled', true),
          longPressEnabled: Storage.get('longPressEnabled', true)
        }
      };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nonogram-progress-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importProgress() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          // Из файла берётся только то, что подходит текущей коллекции:
          // раньше содержимое клалось в хранилище как есть и могло сломать игру
          // так, что она падала при каждом следующем запуске.
          const progress = Storage.sanitizeProgress(data && data.puzzleProgress, PUZZLES, puzzleSolutions);
          if (!progress) {
            this.notify('Не подошло', 'Это не файл прогресса Nanogram — в нём нет данных о кроссвордах.');
            return;
          }
          Storage.set('puzzleProgress', progress);
          const settings = Storage.sanitizeSettings(data.settings);
          if (settings) {
            for (const key of Object.keys(settings)) Storage.set(key, settings[key]);
            this.loadSettings();
            Palette.refresh();
          }
          const restored = Object.keys(progress).length;
          this.hideModal('modal-settings');
          this.showPuzzleSelector();
          this.loadPuzzle(this.currentPuzzleIndex);
          this.notify('Прогресс импортирован',
            restored ? `Восстановлено кроссвордов: ${restored}.` : 'В файле не оказалось подходящих сохранений.');
        } catch (err) {
          this.notify('Ошибка импорта', 'Файл не удалось прочитать: ' + err.message);
        }
      };
      input.click();
    },

    confirmResetAll() {
      document.getElementById('confirm-title').textContent = '⚠ Сбросить весь прогресс?';
      document.getElementById('confirm-text').textContent = 'Все решённые кроссворды, настройки и сохранения будут удалены.';
      this.confirmCallback = () => this.resetAll();
      this.showModal('modal-confirm');
    },

    resetAll() {
      // Окно обещает удалить и настройки — теперь оно не врёт.
      for (const key of ['puzzleProgress', 'lastPuzzleIndex', 'tutorialSeen',
                         'theme', 'soundEnabled', 'hapticEnabled', 'longPressEnabled']) {
        Storage.remove(key);
      }
      this.hideModal('modal-settings');
      this.loadSettings();
      Palette.refresh();
      this.loadPuzzle(0);
      this.showPuzzleSelector();
      this.notify('Готово', 'Прогресс и настройки сброшены.');
    }
  };
