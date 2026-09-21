import { describe, expect, it } from "vitest";
import {
  applyNotation,
  applyStep,
  countPieces,
  createInitialState,
  declareDraw,
  getImmediateDestinations,
  getLegalMoves,
  renderDiagram,
  stateFromPosition,
} from "./engine";
import { coordToSquare, jumpedSquare, squareToCoord } from "./squares";

describe("square numbering", () => {
  it("puts square 1 on Black's near left-center dark square", () => {
    expect(squareToCoord(1)).toEqual({ rank: 0, file: 1 });
    expect(coordToSquare(0, 1)).toBe(1);
    expect(coordToSquare(0, 0)).toBeNull();
  });

  it("puts 11-15 on adjacent forward diagonals", () => {
    expect(squareToCoord(11)).toEqual({ rank: 2, file: 5 });
    expect(squareToCoord(15)).toEqual({ rank: 3, file: 4 });
    expect(jumpedSquare(15, 22)).toBe(18);
  });
});

describe("starting position", () => {
  it("gives Black the seven standard opening moves", () => {
    const moves = getLegalMoves(createInitialState()).map((move) => move.notation).sort();
    expect(moves).toEqual(["10-14", "10-15", "11-15", "11-16", "12-16", "9-13", "9-14"]);
  });

  it("renders Black at the bottom of the ASCII diagram", () => {
    const diagram = renderDiagram(createInitialState());
    const rows = diagram.split("\n");
    expect(rows[0]).toBe("w . w . w . w .");
    expect(rows[7]).toBe(". b . b . b . b");
  });
});

describe("mandatory capture", () => {
  it("forbids quiet moves when a jump exists", () => {
    const state = stateFromPosition({
      blackMen: [15],
      whiteMen: [18],
      sideToMove: "black",
    });
    const moves = getLegalMoves(state);
    expect(moves.map((move) => move.notation)).toEqual(["15x22"]);
    expect(moves[0]?.captured).toEqual([18]);
  });

  it("requires a multi-jump sequence when the same piece can continue", () => {
    const state = stateFromPosition({
      blackMen: [15],
      whiteMen: [18, 25],
      sideToMove: "black",
    });
    const moves = getLegalMoves(state);
    expect(moves.map((move) => move.notation)).toEqual(["15x22x29"]);
  });

  it("keeps the same piece forced after the first jump", () => {
    const afterFirst = applyStep(
      stateFromPosition({
        blackMen: [15],
        whiteMen: [18, 25],
        sideToMove: "black",
      }),
      15,
      22,
    );
    expect(afterFirst.sideToMove).toBe("black");
    expect(afterFirst.forcedSquare).toBe(22);
    expect(getImmediateDestinations(afterFirst, 22)).toEqual([29]);
    expect(getLegalMoves(afterFirst).every((move) => move.from === 22)).toBe(true);
  });
});

describe("promotion", () => {
  it("promotes a man that lands on the back rank and stops the sequence", () => {
    const state = stateFromPosition({
      blackMen: [23],
      whiteMen: [26],
      sideToMove: "black",
    });
    const moves = getLegalMoves(state);
    expect(moves.map((move) => move.notation)).toEqual(["23x30"]);
    expect(moves[0]?.promotes).toBe(true);

    const next = applyNotation(state, "23x30");
    expect(next.pieces[30]?.king).toBe(true);
    expect(next.forcedSquare).toBeNull();
    expect(next.sideToMove).toBe("white");
  });

  it("does not keep jumping after a man promotes, even if a king could", () => {
    const state = stateFromPosition({
      blackMen: [23],
      whiteMen: [26, 21],
      sideToMove: "black",
    });
    const notations = getLegalMoves(state).map((move) => move.notation);
    expect(notations).toEqual(["23x30"]);
    expect(notations).not.toContain("23x30x23");
  });
});

describe("kings", () => {
  it("lets kings move and capture backward", () => {
    const state = stateFromPosition({
      blackKings: [18],
      whiteMen: [15],
      sideToMove: "black",
    });
    expect(getLegalMoves(state).map((move) => move.notation)).toEqual(["18x11"]);
  });
});

describe("turn and outcome", () => {
  it("switches to White after a completed Black quiet move", () => {
    const next = applyNotation(createInitialState(), "11-15");
    expect(next.sideToMove).toBe("white");
    expect(next.lastMove).toEqual({ notation: "11-15", side: "black" });
    expect(next.moveNumber).toBe(1);
  });

  it("increments move number after White replies", () => {
    const afterBlack = applyNotation(createInitialState(), "11-15");
    const whiteMoves = getLegalMoves(afterBlack);
    expect(whiteMoves.length).toBeGreaterThan(0);
    const afterWhite = applyNotation(afterBlack, whiteMoves[0]!.notation);
    expect(afterWhite.sideToMove).toBe("black");
    expect(afterWhite.moveNumber).toBe(2);
  });

  it("awards a win when the opponent has no pieces", () => {
    const state = stateFromPosition({
      blackMen: [15],
      whiteMen: [18],
      sideToMove: "black",
    });
    const next = applyNotation(state, "15x22");
    expect(countPieces(next.pieces, "white")).toBe(0);
    expect(next.result).toBe("black-win");
  });

  it("awards a win when the opponent has no legal move", () => {
    const state = stateFromPosition({
      blackKings: [18],
      whiteMen: [1],
      sideToMove: "black",
    });
    const next = applyNotation(state, "18-15");
    expect(next.result).toBe("black-win");
    expect(next.sideToMove).toBe("white");
  });

  it("records a draw without changing the board", () => {
    const start = createInitialState();
    const drawn = declareDraw(start);
    expect(drawn.result).toBe("draw");
    expect(drawn.pieces).toEqual(start.pieces);
  });
});

describe("notation and descriptions", () => {
  it("uses x for captures and describes the jumped piece", () => {
    const state = stateFromPosition({
      blackMen: [15],
      whiteKings: [18],
      sideToMove: "black",
    });
    const move = getLegalMoves(state)[0]!;
    expect(move.notation).toBe("15x22");
    expect(move.description).toBe("Jump white king 18 with black man 15, landing on 22");
  });
});
