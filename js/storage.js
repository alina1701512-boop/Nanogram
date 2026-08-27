  // ===================== STORAGE =====================
  export const Storage = {
    get(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },

    encodeGrid(grid) {
      const flat = [];
      for (const row of grid) for (const v of row) flat.push(v);
      const rle = [];
      let cur = flat[0], count = 1;
      for (let i = 1; i < flat.length; i++) {
        if (flat[i] === cur) count++;
        else { rle.push(count + ':' + cur); cur = flat[i]; count = 1; }
      }
      rle.push(count + ':' + cur);
      return { _rle: true, size: grid.length, data: rle.join(',') };
    },

    // Возвращает поле или null. Раньше значение без флага _rle возвращалось
    // как есть — число или строка из битого файла доезжали до отрисовки и
    // роняли приложение при каждом запуске, пока не почистить localStorage.
    decodeGrid(encoded) {
      if (!encoded || encoded._rle !== true || typeof encoded.data !== 'string') return null;
      const size = encoded.size;
      if (!Number.isInteger(size) || size < 1 || size > 100) return null;
      const flat = [];
      for (const part of encoded.data.split(',')) {
        const pieces = part.split(':');
        if (pieces.length !== 2) return null;
        const count = parseInt(pieces[0], 10), val = parseInt(pieces[1], 10);
        if (!Number.isInteger(count) || count < 1 || !Number.isInteger(val)) return null;
        if (flat.length + count > size * size) return null;
        for (let i = 0; i < count; i++) flat.push(val);
      }
      if (flat.length !== size * size) return null;
      const grid = [];
      for (let r = 0; r < size; r++) grid.push(flat.slice(r * size, (r + 1) * size));
      return grid;
    },

    isValidGrid(grid, size) {
      if (!Array.isArray(grid) || grid.length !== size) return false;
      for (const row of grid) {
        if (!Array.isArray(row) || row.length !== size) return false;
        for (const v of row) if (v !== 0 && v !== 1 && v !== 2) return false;
      }
      return true;
    },

    // Подпись кроссворда: если картинку когда-нибудь поправить, старое
    // сохранение перестанет подходить под новое поле и будет отброшено.
    signature(solution) {
      let filled = 0;
      for (const row of solution) for (const v of row) if (v === 1) filled++;
      return solution.length + ':' + filled;
    },

    // Оставляет от чужого объекта прогресса только то, что имеет смысл:
    // известные номера кроссвордов, поля нужного размера, числа вместо чего угодно.
    sanitizeProgress(raw, puzzles, solutions) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const clean = {};
      for (const key of Object.keys(raw)) {
        const index = parseInt(key, 10);
        if (!Number.isInteger(index) || index < 0 || index >= puzzles.length) continue;
        const entry = raw[key];
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

        const size = puzzles[index].size;
        const out = {
          solved: entry.solved === true,
          errors: Number.isFinite(entry.errors) && entry.errors >= 0 ? Math.floor(entry.errors) : 0,
          elapsed: Number.isFinite(entry.elapsed) && entry.elapsed >= 0 ? Math.floor(entry.elapsed) : 0,
          sig: this.signature(solutions[index])
        };
        if (Number.isInteger(entry.stars) && entry.stars >= 1 && entry.stars <= 3) out.stars = entry.stars;
        if (Number.isFinite(entry.bestTime) && entry.bestTime >= 0) out.bestTime = Math.floor(entry.bestTime);
        if (entry.sig === undefined || entry.sig === out.sig) {
          if (this.isValidGrid(this.decodeGrid(entry.grid), size)) out.grid = entry.grid;
          if (this.isValidGrid(this.decodeGrid(entry.memoGrid), size)) out.memoGrid = entry.memoGrid;
        }
        clean[index] = out;
      }
      return clean;
    },

    sanitizeSettings(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const clean = {};
      if (raw.theme === 'dark' || raw.theme === 'light') clean.theme = raw.theme;
      for (const key of ['soundEnabled', 'hapticEnabled', 'longPressEnabled']) {
        if (typeof raw[key] === 'boolean') clean[key] = raw[key];
      }
      return clean;
    }
  };
