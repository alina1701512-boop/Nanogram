  // ===================== HAPTICS =====================
  export const Haptics = {
    enabled: true,
    vibrate(pattern) { if (this.enabled && 'vibrate' in navigator) { try { navigator.vibrate(pattern); } catch (e) {} } },
    tap() { this.vibrate(8); },
    paint() { this.vibrate(12); },
    x() { this.vibrate([5, 20, 5]); },
    memo() { this.vibrate(6); },
    error() { this.vibrate([40, 30, 40]); },
    mode() { this.vibrate(15); },
    lineSolved() { this.vibrate([20, 30, 40]); },
    win() { this.vibrate([80, 40, 80, 40, 200]); }
  };
