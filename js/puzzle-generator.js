  // ===================== ГЕНЕРАТОРЫ ===================== //
  export const PuzzleGenerator = {
    heart(size) {
      const grid = [];
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          const nx = (x - size / 2) / (size / 2.4);
          const ny = -(y - size / 2) / (size / 2.4) - 0.2;
          const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
          row.push(v < 0 ? 1 : 0);
        }
        grid.push(row);
      }
      return grid;
    },
    star(size) {
      const grid = [];
      const cx = size / 2, cy = size / 2;
      const outerR = size * 0.45, innerR = size * 0.18;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let angle = Math.atan2(dy, dx) + Math.PI / 2;
          if (angle < 0) angle += Math.PI * 2;
          const points = 5;
          const sector = (Math.PI * 2) / points;
          const halfSector = sector / 2;
          const localAngle = angle % sector;
          const t = localAngle < halfSector ? localAngle / halfSector : (sector - localAngle) / halfSector;
          const r = innerR + (outerR - innerR) * t;
          row.push(dist < r ? 1 : 0);
        }
        grid.push(row);
      }
      return grid;
    },
    house(size) {
      const grid = [];
      const roofTop = Math.floor(size * 0.1);
      const roofBottom = Math.floor(size * 0.45);
      const wallBottom = Math.floor(size * 0.9);
      const leftWall = Math.floor(size * 0.2);
      const rightWall = Math.floor(size * 0.8);
      const doorLeft = Math.floor(size * 0.4);
      const doorRight = Math.floor(size * 0.6);
      const windowSize = Math.floor(size * 0.1);
      const windowY = Math.floor(size * 0.55);
      const windowX1 = Math.floor(size * 0.3);
      const windowX2 = Math.floor(size * 0.65);
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          if (y >= roofTop && y <= roofBottom) {
            const progress = (y - roofTop) / (roofBottom - roofTop);
            const halfWidth = progress * (rightWall - leftWall) / 2;
            const cx = (leftWall + rightWall) / 2;
            if (x >= cx - halfWidth && x <= cx + halfWidth) fill = 1;
          }
          if (y > roofBottom && y <= wallBottom) {
            if (x >= leftWall && x <= rightWall) {
              if (x >= doorLeft && x <= doorRight && y > wallBottom - (wallBottom - roofBottom) * 0.7) fill = 0;
              else fill = 1;
            }
          }
          if (y >= windowY && y < windowY + windowSize) {
            if ((x >= windowX1 && x < windowX1 + windowSize) || (x >= windowX2 && x < windowX2 + windowSize)) fill = 0;
          }
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    // Раньше лицо рисовалось тонким кольцом-контуром (толщиной в одну клетку) —
    // на редакторской проверке решателем кроссворд не решался логикой: 120 клеток
    // оставались неопределены, у фигуры было несколько разных верных решений.
    // Сплошной диск с вырезанными дырками решается однозначно.
    smiley(size) {
      const grid = [];
      const cx = size / 2, cy = size / 2;
      const faceR = size * 0.42;
      const eyeR = size * 0.07;
      const eyeY = cy - size * 0.08;
      const eyeXOffset = size * 0.16;
      const mouthCy = cy + size * 0.06;
      const mouthR = size * 0.22;
      const mouthThickness = size * 0.08;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          const dist = Math.hypot(x - cx, y - cy);
          let fill = dist <= faceR ? 1 : 0;
          const d1 = Math.hypot(x - (cx - eyeXOffset), y - eyeY);
          const d2 = Math.hypot(x - (cx + eyeXOffset), y - eyeY);
          if (d1 <= eyeR || d2 <= eyeR) fill = 0;
          const mdx = x - cx, mdy = y - mouthCy;
          const mdist = Math.hypot(mdx, mdy);
          if (mdy > 0 && mdist <= mouthR && mdist >= mouthR - mouthThickness) fill = 0;
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    tree(size) {
      const grid = [];
      const layers = [
        { top: 0.05, bottom: 0.35, widthTop: 0.05, widthBottom: 0.35 },
        { top: 0.28, bottom: 0.58, widthTop: 0.1, widthBottom: 0.42 },
        { top: 0.5, bottom: 0.82, widthTop: 0.15, widthBottom: 0.48 }
      ];
      const trunkTop = 0.82, trunkBottom = 0.98, trunkWidth = 0.08;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          const ny = y / size, nx = x / size;
          let fill = 0;
          for (const layer of layers) {
            if (ny >= layer.top && ny <= layer.bottom) {
              const progress = (ny - layer.top) / (layer.bottom - layer.top);
              const halfWidth = layer.widthTop + (layer.widthBottom - layer.widthTop) * progress;
              if (nx >= 0.5 - halfWidth && nx <= 0.5 + halfWidth) fill = 1;
            }
          }
          if (ny >= trunkTop && ny <= trunkBottom && nx >= 0.5 - trunkWidth && nx <= 0.5 + trunkWidth) fill = 1;
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    fish(size) {
      const grid = [];
      const cx = size * 0.45, cy = size * 0.5;
      const bodyRx = size * 0.3, bodyRy = size * 0.22;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          const dx = x - cx, dy = y - cy;
          if ((dx*dx)/(bodyRx*bodyRx) + (dy*dy)/(bodyRy*bodyRy) <= 1) fill = 1;
          const tailStart = cx + bodyRx * 0.7, tailEnd = size * 0.9;
          if (x >= tailStart && x <= tailEnd) {
            const progress = (x - tailStart) / (tailEnd - tailStart);
            if (Math.abs(y - cy) <= bodyRy * (1 - progress) * 1.2) fill = 1;
          }
          const eyeX = cx - bodyRx * 0.4, eyeY = cy - bodyRy * 0.2;
          if (Math.sqrt((x-eyeX)**2 + (y-eyeY)**2) < size * 0.03) fill = 0;
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    cat(size) {
      const grid = [];
      const cx = size / 2, cy = size * 0.55, headR = size * 0.28;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          const dx = x - cx, dy = y - cy;
          if (Math.sqrt(dx*dx + dy*dy) <= headR) fill = 1;
          const earY = cy - headR * 0.6, earWidth = size * 0.12, earHeight = size * 0.18;
          const leftEarX = cx - headR * 0.6;
          if (y >= earY - earHeight && y <= earY) {
            const progress = (earY - y) / earHeight;
            const halfW = earWidth * (1 - progress);
            if (x >= leftEarX - halfW && x <= leftEarX + halfW) fill = 1;
          }
          const rightEarX = cx + headR * 0.6;
          if (y >= earY - earHeight && y <= earY) {
            const progress = (earY - y) / earHeight;
            const halfW = earWidth * (1 - progress);
            if (x >= rightEarX - halfW && x <= rightEarX + halfW) fill = 1;
          }
          const eyeY = cy - headR * 0.1, eyeXOffset = headR * 0.4, eyeR = size * 0.04;
          if (Math.sqrt((x-(cx-eyeXOffset))**2 + (y-eyeY)**2) < eyeR || Math.sqrt((x-(cx+eyeXOffset))**2 + (y-eyeY)**2) < eyeR) fill = 0;
          const noseY = cy + headR * 0.2, noseSize = size * 0.03;
          if (y >= noseY && y <= noseY + noseSize) {
            const progress = (y - noseY) / noseSize;
            const halfW = noseSize * progress;
            if (x >= cx - halfW && x <= cx + halfW) fill = 0;
          }
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    mushroom(size) {
      const grid = [];
      const capCx = size / 2, capCy = size * 0.35, capRx = size * 0.4, capRy = size * 0.25;
      const stemLeft = size * 0.38, stemRight = size * 0.62, stemTop = size * 0.5, stemBottom = size * 0.9;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          const dx = x - capCx, dy = y - capCy;
          if ((dx*dx)/(capRx*capRx) + (dy*dy)/(capRy*capRy) <= 1 && y <= capCy + capRy * 0.3) fill = 1;
          if (y >= stemTop && y <= stemBottom) {
            const progress = (y - stemTop) / (stemBottom - stemTop);
            const halfWidth = (stemRight - stemLeft) / 2 * (1 + progress * 0.15);
            const stemCx = (stemLeft + stemRight) / 2;
            if (x >= stemCx - halfWidth && x <= stemCx + halfWidth) fill = 1;
          }
          const spots = [
            { x: capCx - capRx * 0.4, y: capCy - capRy * 0.3, r: size * 0.04 },
            { x: capCx + capRx * 0.3, y: capCy - capRy * 0.4, r: size * 0.035 },
            { x: capCx, y: capCy - capRy * 0.1, r: size * 0.03 }
          ];
          for (const spot of spots) {
            if (Math.sqrt((x-spot.x)**2 + (y-spot.y)**2) < spot.r) fill = 0;
          }
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    sailboat(size) {
      const grid = [];
      const mastX = Math.floor(size * 0.5), sailTop = Math.floor(size * 0.1), sailBottom = Math.floor(size * 0.65), hullTop = Math.floor(size * 0.7), hullBottom = Math.floor(size * 0.92);
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          if (x >= mastX - 1 && x <= mastX + 1 && y >= sailTop && y <= hullBottom) fill = 1;
          if (y >= sailTop && y <= sailBottom && x > mastX) {
            const progress = (y - sailTop) / (sailBottom - sailTop);
            if (x <= mastX + size * 0.35 * progress) fill = 1;
          }
          if (y >= hullTop && y <= hullBottom) {
            const progress = (y - hullTop) / (hullBottom - hullTop);
            const halfWidth = size * 0.4 * (1 - progress * 0.4);
            if (x >= mastX - halfWidth && x <= mastX + halfWidth) fill = 1;
          }
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    rocket(size) {
      const grid = [];
      const cx = size / 2, bodyHalfW = size * 0.12;
      const noseTop = size * 0.05, noseBottom = size * 0.25, bodyTop = size * 0.25, bodyBottom = size * 0.75;
      const finTop = size * 0.6, finBottom = size * 0.85, flameTop = size * 0.75, flameBottom = size * 0.95;
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          if (y >= noseTop && y <= noseBottom) {
            const progress = (y - noseTop) / (noseBottom - noseTop);
            if (x >= cx - bodyHalfW * progress && x <= cx + bodyHalfW * progress) fill = 1;
          }
          if (y >= bodyTop && y <= bodyBottom && x >= cx - bodyHalfW && x <= cx + bodyHalfW) fill = 1;
          const windowY = bodyTop + (bodyBottom - bodyTop) * 0.3, windowR = size * 0.05;
          if (Math.sqrt((x-cx)**2 + (y-windowY)**2) < windowR) fill = 0;
          if (y >= finTop && y <= finBottom) {
            const progress = (y - finTop) / (finBottom - finTop);
            const finWidth = bodyHalfW + size * 0.15 * progress;
            if ((x >= cx - finWidth && x < cx - bodyHalfW) || (x > cx + bodyHalfW && x <= cx + finWidth)) fill = 1;
          }
          if (y >= flameTop && y <= flameBottom) {
            const progress = (y - flameTop) / (flameBottom - flameTop);
            if (x >= cx - bodyHalfW * (1 - progress * 0.6) && x <= cx + bodyHalfW * (1 - progress * 0.6)) fill = 1;
          }
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },
    castle(size) {
      const grid = [];
      const baseTop = Math.floor(size * 0.35), baseBottom = Math.floor(size * 0.95), baseLeft = Math.floor(size * 0.15), baseRight = Math.floor(size * 0.85);
      const towerWidth = Math.floor(size * 0.12), towerTop = Math.floor(size * 0.15);
      for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
          let fill = 0;
          if (y >= baseTop && y <= baseBottom && x >= baseLeft && x <= baseRight) fill = 1;
          if (y >= towerTop && y <= baseBottom && x >= baseLeft - towerWidth/2 && x <= baseLeft + towerWidth/2) fill = 1;
          if (y >= towerTop && y <= baseBottom && x >= baseRight - towerWidth/2 && x <= baseRight + towerWidth/2) fill = 1;
          const ctt = Math.floor(size * 0.1), ctw = Math.floor(size * 0.15);
          if (y >= ctt && y <= baseTop && x >= size/2 - ctw/2 && x <= size/2 + ctw/2) fill = 1;
          const gateLeft = Math.floor(size * 0.43), gateRight = Math.floor(size * 0.57), gateTop = Math.floor(size * 0.7);
          if (y >= gateTop && y <= baseBottom && x >= gateLeft && x <= gateRight) {
            const gateCx = (gateLeft + gateRight) / 2, gateR = (gateRight - gateLeft) / 2;
            if ((y - gateTop) < gateR && (x-gateCx)**2 + (y-gateTop)**2 > gateR*gateR) fill = 1;
            else fill = 0;
          }
          row.push(fill);
        }
        grid.push(row);
      }
      return grid;
    },

    // Кроссворд прямо строками из символов — картинку видно в самом коде,
    // добавить новую фигуру можно за пять минут, не изобретая формулу.
    // '#' и любой другой не-пробельный символ — закрашенная клетка, '.' и
    // пробел — пустая.
    fromArt(rows) {
      return rows.map(row => [...row].map(ch => (ch === '.' || ch === ' ') ? 0 : 1));
    },

    // Формульные фигуры рисуются на фиксированном квадратном холсте, но сама
    // фигура часто занимает от него меньше половины (см. разбор) — кроссворд
    // 20×20 наполовину состоит из пустой рамки, которую играющий крестит
    // машинально в первые полминуты. Обрезка по границам фигуры плюс отступ
    // в одну клетку с каждой стороны решает это, не трогая формулу; если
    // обрезка не даёт выигрыша (фигура и так плотная), холст не меняется.
    tighten(grid, margin = 1) {
      const n = grid.length;
      let r0 = n, r1 = -1, c0 = n, c1 = -1;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (grid[r][c]) {
            if (r < r0) r0 = r;
            if (r > r1) r1 = r;
            if (c < c0) c0 = c;
            if (c > c1) c1 = c;
          }
        }
      }
      if (r1 < 0) return grid; // пустая картинка — оставить как есть
      const bh = r1 - r0 + 1, bw = c1 - c0 + 1;
      const size = Math.max(bh, bw) + margin * 2;
      if (size >= n) return grid;
      const out = Array.from({ length: size }, () => Array(size).fill(0));
      const offY = Math.floor((size - bh) / 2), offX = Math.floor((size - bw) / 2);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (grid[r][c]) out[r - r0 + offY][c - c0 + offX] = 1;
      return out;
    }
  };
