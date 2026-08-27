import { PuzzleGenerator } from './puzzle-generator.js';
import { Solver } from './solver.js';

  // ===================== КОЛЛЕКЦИЯ =====================
  // pack группирует кроссворды в главы для списка. size больше не указывается
  // руками — он определяется по факту сгенерированной картинки (см. ниже),
  // поэтому обрезка формульных фигур (tighten) меняет его автоматически.
  export const PUZZLES = [
    { name: "Сердце", pack: "Фигуры", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.heart(15)) },
    { name: "Звезда", pack: "Фигуры", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.star(15)) },
    { name: "Дом", pack: "Фигуры", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.house(15)) },
    { name: "Смайлик", pack: "Фигуры", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.smiley(15)) },
    // Чашка нарисована прямо строками символов (PuzzleGenerator.fromArt), а не
    // формулой — самый маленький кроссворд в коллекции, для быстрой партии.
    { name: "Чашка", pack: "Фигуры", generator: () => PuzzleGenerator.fromArt([
      "..........",
      ".########.",
      ".#......#.",
      ".#......##",
      ".#......#.",
      ".#......##",
      ".#......#.",
      ".#......#.",
      ".########.",
      ".........."
    ]) },
    { name: "Ёлка", pack: "Природа", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.tree(15)) },
    { name: "Гриб", pack: "Природа", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.mushroom(20)) },
    { name: "Кот", pack: "Природа", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.cat(20)) },
    { name: "Рыбка", pack: "Природа", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.fish(20)) },
    { name: "Парусник", pack: "Приключения", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.sailboat(25)) },
    { name: "Ракета", pack: "Приключения", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.rocket(25)) },
    { name: "Замок", pack: "Приключения", generator: () => PuzzleGenerator.tighten(PuzzleGenerator.castle(30)) }
  ];
  export const puzzleSolutions = PUZZLES.map(p => p.generator());
  // Сложность считается решателем по форме фигуры, а не берётся из руки —
  // раньше она была жёстко привязана к размеру поля (15×15 всегда «Легко»,
  // 30×30 всегда «Сложно»), хотя реальная сложность линий не коррелировала
  // с размером почти никак (см. разбор). Заодно решатель проверяет, что
  // каждый кроссворд решается логикой целиком — если нет, в консоль уйдёт
  // предупреждение при следующем добавлении фигур.
  export const puzzleStats = puzzleSolutions.map(sol => Solver.analyze(sol));
  PUZZLES.forEach((p, i) => {
    p.size = puzzleSolutions[i].length;
    p.difficulty = Solver.difficulty(puzzleStats[i]);
    if (!puzzleStats[i].solvable && typeof console !== 'undefined') {
      console.warn(`Кроссворд «${p.name}» не решается логикой построчного решателя — есть неоднозначные клетки.`);
    }
  });
