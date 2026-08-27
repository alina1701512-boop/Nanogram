  // ===================== ПАЛИТРА =====================
  // Цвета читаются из CSS один раз и перечитываются при смене темы.
  // Раньше getPropertyValue вызывался внутри цикла по клеткам — до девяти тысяч
  // синхронных пересчётов стиля на кадр. Здесь же лечится и баг с чёрным
  // перекрестием: значение переменной приходит с ведущим пробелом, и без trim()
  // canvas молча отвергал присваивание fillStyle, оставляя прошлый цвет.
  export const Palette = {
    keys: [
      '--color-cell-bg', '--color-cell-border', '--color-grid-border', '--color-fill',
      '--color-x', '--color-memo', '--color-hint', '--color-solved', '--color-solved-text',
      '--color-highlight', '--color-frost-glow'
    ],
    values: {},
    refresh() {
      const styles = getComputedStyle(document.documentElement);
      for (const key of this.keys) this.values[key] = styles.getPropertyValue(key).trim();
    },
    get(key) { return this.values[key] || '#000000'; }
  };
