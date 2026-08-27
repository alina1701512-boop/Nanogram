  // ===================== РЕШАТЕЛЬ =====================
  // Построчный логический решатель нонограмм: по числам-подсказкам линии выводит
  // клетки, которые определены однозначно, и повторяет для всех строк/столбцов,
  // пока выводится хоть что-то новое. Если в конце остаются неопределённые клетки —
  // кроссворд нельзя решить логикой, только угадыванием. На этом же прогоне
  // считается настоящая сложность: она не размер поля, а то, сколько проходов
  // потребовалось и сколько в линиях независимых групп подряд.
  export const Solver = {
    lineHints(line) {
      const hints = [];
      let count = 0;
      for (const v of line) {
        if (v === 1) count++;
        else { if (count > 0) hints.push(count); count = 0; }
      }
      if (count > 0) hints.push(count);
      return hints.length ? hints : [0];
    },

    // Для одной линии длины n с подсказками hints и уже известными клетками
    // (0 — точно пусто, 1 — точно закрашено, -1 — неизвестно) возвращает массив
    // того же вида, но с довыведенными клетками, или null, если подсказки
    // противоречат уже известным клеткам.
    solveLine(hints, known) {
      const n = known.length, k = hints.length;
      const memo = new Map();
      const fits = (i, j) => {
        if (j === k) {
          for (let t = i; t < n; t++) if (known[t] === 1) return false;
          return true;
        }
        if (i >= n) return false;
        const key = i * (k + 2) + j;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;
        let ok = false;
        if (known[i] !== 1 && fits(i + 1, j)) ok = true;
        if (!ok) {
          const h = hints[j];
          if (i + h <= n) {
            let can = true;
            for (let t = i; t < i + h; t++) if (known[t] === 0) { can = false; break; }
            if (can && (i + h === n || known[i + h] !== 1) && fits(i + h + 1, j + 1)) ok = true;
          }
        }
        memo.set(key, ok);
        return ok;
      };
      if (!fits(0, 0)) return null;

      const can = new Array(n).fill(0); // бит 1 — встречается пустой вариант, бит 2 — закрашенный
      const seen = new Set();
      const walk = (i, j) => {
        const key = i * (k + 2) + j;
        if (seen.has(key)) return;
        seen.add(key);
        if (j === k) { for (let t = i; t < n; t++) can[t] |= 1; return; }
        if (i >= n) return;
        if (known[i] !== 1 && fits(i + 1, j)) { can[i] |= 1; walk(i + 1, j); }
        const h = hints[j];
        if (i + h <= n) {
          let ok = true;
          for (let t = i; t < i + h; t++) if (known[t] === 0) { ok = false; break; }
          if (ok && (i + h === n || known[i + h] !== 1) && fits(i + h + 1, j + 1)) {
            for (let t = i; t < i + h; t++) can[t] |= 2;
            if (i + h < n) can[i + h] |= 1;
            walk(i + h + 1, j + 1);
          }
        }
      };
      walk(0, 0);
      return can.map(v => v === 1 ? 0 : v === 2 ? 1 : -1);
    },

    // Полный разбор кроссворда: решаемость логикой, число проходов, метрики для
    // расчёта сложности. Не угадывает — только то, что выводится однозначно.
    analyze(solution) {
      const n = solution.length;
      const rowHints = solution.map(row => this.lineHints(row));
      const colHints = [];
      for (let c = 0; c < n; c++) colHints.push(this.lineHints(solution.map(row => row[c])));

      const grid = Array.from({ length: n }, () => new Array(n).fill(-1));
      let unknown = n * n, passes = 0, changed = true, contradiction = false;
      while (changed && unknown > 0 && passes < 300 && !contradiction) {
        changed = false; passes++;
        for (let r = 0; r < n && !contradiction; r++) {
          const res = this.solveLine(rowHints[r], grid[r]);
          if (!res) { contradiction = true; break; }
          for (let c = 0; c < n; c++) if (res[c] !== -1 && grid[r][c] === -1) { grid[r][c] = res[c]; unknown--; changed = true; }
        }
        for (let c = 0; c < n && !contradiction; c++) {
          const col = grid.map(row => row[c]);
          const res = this.solveLine(colHints[c], col);
          if (!res) { contradiction = true; break; }
          for (let r = 0; r < n; r++) if (res[r] !== -1 && grid[r][c] === -1) { grid[r][c] = res[r]; unknown--; changed = true; }
        }
      }

      const allHints = [...rowHints, ...colHints];
      const totalGroups = allHints.reduce((s, h) => s + h.length, 0);
      const avgGroups = totalGroups / allHints.length;
      const maxGroups = Math.max(...allHints.map(h => h.length));
      const filled = solution.flat().filter(v => v === 1).length;
      const solvable = !contradiction && unknown === 0;
      const score = passes * 2 + avgGroups * 4 + maxGroups * 1.5 + n / 15;

      return { solvable, unknown, passes, avgGroups, maxGroups, density: filled / (n * n), score };
    },

    // Пороги откалиброваны прогоном по всей текущей коллекции (см. разбор):
    // размер поля не участвует напрямую — сложность целиком из формы фигуры.
    difficulty(stats) {
      if (stats.score < 13) return 'Легко';
      if (stats.score < 16) return 'Средне';
      return 'Сложно';
    }
  };
