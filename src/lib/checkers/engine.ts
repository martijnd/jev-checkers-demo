import { coordToSquare, isKingRank, jumpedSquare, squareToCoord } from "./squares";
import type {
  CaptureKind,
  GameState,
  Move,
  Piece,
  SerializedGame,
  Side,
} from "./types";

const BLACK_DIRS: Array<readonly [number, number]> = [
  [1, -1],
  [1, 1],
];
const WHITE_DIRS: Array<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
];
const KING_DIRS: Array<readonly [number, number]> = [
  [1, -1],
  [1, 1],
  [-1, -1],
  [-1, 1],
];

function emptyPieces(): Array<Piece | null> {
  return Array.from({ length: 33 }, () => null);
}

function cloneState(state: GameState): GameState {
  return {
    pieces: state.pieces.slice(),
    sideToMove: state.sideToMove,
    forcedSquare: state.forcedSquare,
    comboOrigin: state.comboOrigin,
    comboLandings: state.comboLandings === null ? null : state.comboLandings.slice(),
    moveNumber: state.moveNumber,
    lastMove: state.lastMove === null ? null : { ...state.lastMove },
    capturedByBlack: state.capturedByBlack.slice(),
    capturedByWhite: state.capturedByWhite.slice(),
    result: state.result,
  };
}

export function createInitialState(): GameState {
  const pieces = emptyPieces();
  for (let square = 1; square <= 12; square += 1) {
    pieces[square] = { side: "black", king: false };
  }
  for (let square = 21; square <= 32; square += 1) {
    pieces[square] = { side: "white", king: false };
  }
  return {
    pieces,
    sideToMove: "black",
    forcedSquare: null,
    comboOrigin: null,
    comboLandings: null,
    moveNumber: 1,
    lastMove: null,
    capturedByBlack: [],
    capturedByWhite: [],
    result: "playing",
  };
}

export function stateFromPosition(spec: {
  blackMen?: Array<number>;
  blackKings?: Array<number>;
  whiteMen?: Array<number>;
  whiteKings?: Array<number>;
  sideToMove?: Side;
  forcedSquare?: number | null;
}): GameState {
  const pieces = emptyPieces();
  for (const square of spec.blackMen ?? []) {
    pieces[square] = { side: "black", king: false };
  }
  for (const square of spec.blackKings ?? []) {
    pieces[square] = { side: "black", king: true };
  }
  for (const square of spec.whiteMen ?? []) {
    pieces[square] = { side: "white", king: false };
  }
  for (const square of spec.whiteKings ?? []) {
    pieces[square] = { side: "white", king: true };
  }
  return {
    pieces,
    sideToMove: spec.sideToMove ?? "black",
    forcedSquare: spec.forcedSquare ?? null,
    comboOrigin: spec.forcedSquare ?? null,
    comboLandings: spec.forcedSquare === undefined || spec.forcedSquare === null ? null : [],
    moveNumber: 1,
    lastMove: null,
    capturedByBlack: [],
    capturedByWhite: [],
    result: "playing",
  };
}

function directionsFor(piece: Piece): Array<readonly [number, number]> {
  if (piece.king) {
    return KING_DIRS;
  }
  return piece.side === "black" ? BLACK_DIRS : WHITE_DIRS;
}

function pieceAt(pieces: Array<Piece | null>, square: number): Piece | null {
  return pieces[square] ?? null;
}

function pieceLabel(piece: Piece): string {
  return `${piece.side} ${piece.king ? "king" : "man"}`;
}

function moveNotation(from: number, path: Array<number>, captured: Array<number>): string {
  if (captured.length === 0) {
    return `${from}-${path[0]}`;
  }
  return `${from}x${path.join("x")}`;
}

function describeMove(
  mover: Piece,
  from: number,
  path: Array<number>,
  capturedSquares: Array<number>,
  capturedPieces: Array<Piece>,
): string {
  if (capturedSquares.length === 0) {
    return `Move ${pieceLabel(mover)} ${from} to ${path[0]} (quiet)`;
  }
  const jumped = capturedSquares.map((square, index) => {
    return `${pieceLabel(capturedPieces[index])} ${square}`;
  });
  if (jumped.length === 1) {
    return `Jump ${jumped[0]} with ${pieceLabel(mover)} ${from}, landing on ${path[0]}`;
  }
  return `Jump ${jumped.join(" then ")} with ${pieceLabel(mover)} ${from}, landing on ${path.join(" then ")}`;
}

interface JumpStep {
  over: number;
  to: number;
  victim: Piece;
}

function immediateJumps(
  from: number,
  piece: Piece,
  pieces: Array<Piece | null>,
): Array<JumpStep> {
  const { rank, file } = squareToCoord(from);
  const steps: Array<JumpStep> = [];
  for (const [dRank, dFile] of directionsFor(piece)) {
    const over = coordToSquare(rank + dRank, file + dFile);
    const to = coordToSquare(rank + 2 * dRank, file + 2 * dFile);
    if (over === null || to === null) {
      continue;
    }
    const victim = pieceAt(pieces, over);
    if (victim === null || victim.side === piece.side) {
      continue;
    }
    if (pieceAt(pieces, to) !== null) {
      continue;
    }
    steps.push({ over, to, victim });
  }
  return steps;
}

function exploreJumps(
  from: number,
  origin: number,
  piece: Piece,
  pieces: Array<Piece | null>,
  capturedSquares: Array<number>,
  capturedPieces: Array<Piece>,
  path: Array<number>,
): Array<Move> {
  const options = immediateJumps(from, piece, pieces);
  if (options.length === 0) {
    if (path.length === 0) {
      return [];
    }
    return [
      {
        from: origin,
        path: path.slice(),
        captured: capturedSquares.slice(),
        notation: moveNotation(origin, path, capturedSquares),
        description: describeMove(piece, origin, path, capturedSquares, capturedPieces),
        promotes: false,
      },
    ];
  }

  const moves: Array<Move> = [];
  for (const step of options) {
    const nextPieces = pieces.slice();
    nextPieces[from] = null;
    nextPieces[step.over] = null;
    const nextPiece: Piece = { side: piece.side, king: piece.king };
    const promotes = !piece.king && isKingRank(step.to, piece.side);
    if (promotes) {
      nextPiece.king = true;
    }
    nextPieces[step.to] = nextPiece;
    const nextCapturedSquares = [...capturedSquares, step.over];
    const nextCapturedPieces = [...capturedPieces, step.victim];
    const nextPath = [...path, step.to];
    if (promotes) {
      moves.push({
        from: origin,
        path: nextPath,
        captured: nextCapturedSquares,
        notation: moveNotation(origin, nextPath, nextCapturedSquares),
        description: describeMove(
          { side: piece.side, king: false },
          origin,
          nextPath,
          nextCapturedSquares,
          nextCapturedPieces,
        ),
        promotes: true,
      });
      continue;
    }
    moves.push(
      ...exploreJumps(
        step.to,
        origin,
        nextPiece,
        nextPieces,
        nextCapturedSquares,
        nextCapturedPieces,
        nextPath,
      ),
    );
  }
  return moves;
}

function quietMovesFrom(from: number, piece: Piece, pieces: Array<Piece | null>): Array<Move> {
  const { rank, file } = squareToCoord(from);
  const moves: Array<Move> = [];
  for (const [dRank, dFile] of directionsFor(piece)) {
    const to = coordToSquare(rank + dRank, file + dFile);
    if (to === null || pieceAt(pieces, to) !== null) {
      continue;
    }
    const promotes = !piece.king && isKingRank(to, piece.side);
    moves.push({
      from,
      path: [to],
      captured: [],
      notation: `${from}-${to}`,
      description: describeMove(piece, from, [to], [], []),
      promotes,
    });
  }
  return moves;
}

function occupiedSquares(state: GameState, side: Side): Array<number> {
  const squares: Array<number> = [];
  for (let square = 1; square <= 32; square += 1) {
    const piece = state.pieces[square];
    if (piece !== null && piece.side === side) {
      squares.push(square);
    }
  }
  return squares;
}

export function getLegalMoves(state: GameState): Array<Move> {
  if (state.result !== "playing") {
    return [];
  }
  const side = state.sideToMove;
  const origins =
    state.forcedSquare === null ? occupiedSquares(state, side) : [state.forcedSquare];
  const jumps: Array<Move> = [];
  for (const from of origins) {
    const piece = state.pieces[from];
    if (piece === null || piece.side !== side) {
      continue;
    }
    jumps.push(...exploreJumps(from, from, piece, state.pieces, [], [], []));
  }
  if (jumps.length > 0 || state.forcedSquare !== null) {
    return jumps;
  }
  const quiets: Array<Move> = [];
  for (const from of origins) {
    const piece = state.pieces[from];
    if (piece === null || piece.side !== side) {
      continue;
    }
    quiets.push(...quietMovesFrom(from, piece, state.pieces));
  }
  return quiets;
}

export function getImmediateDestinations(state: GameState, from: number): Array<number> {
  const seen = new Set<number>();
  for (const move of getLegalMoves(state)) {
    if (move.from === from) {
      seen.add(move.path[0]);
    }
  }
  return Array.from(seen);
}

export function countPieces(pieces: Array<Piece | null>, side: Side): number {
  let count = 0;
  for (let square = 1; square <= 32; square += 1) {
    const piece = pieces[square];
    if (piece !== null && piece.side === side) {
      count += 1;
    }
  }
  return count;
}

export function applyStep(state: GameState, from: number, to: number): GameState {
  if (state.result !== "playing") {
    throw new Error("Game is over");
  }
  const matching = getLegalMoves(state).filter((move) => {
    return move.from === from && move.path[0] === to;
  });
  if (matching.length === 0) {
    throw new Error(`Illegal move ${from} to ${to}`);
  }

  const next = cloneState(state);
  const mover = next.pieces[from];
  if (mover === null) {
    throw new Error(`No piece on ${from}`);
  }

  const isJump = matching[0].captured.length > 0;
  next.pieces[from] = null;

  if (isJump) {
    const over = jumpedSquare(from, to);
    const victim = next.pieces[over];
    if (victim === null) {
      throw new Error(`Expected a captured piece on ${over}`);
    }
    next.pieces[over] = null;
    const kind: CaptureKind = victim.king ? "king" : "man";
    if (mover.side === "black") {
      next.capturedByBlack.push(kind);
    } else {
      next.capturedByWhite.push(kind);
    }
  }

  const promotes = !mover.king && isKingRank(to, mover.side);
  next.pieces[to] = { side: mover.side, king: mover.king || promotes };

  const origin = next.comboOrigin ?? from;
  const landings = [...(next.comboLandings ?? []), to];
  next.forcedSquare = to;
  next.comboOrigin = origin;
  next.comboLandings = landings;

  const continues = isJump && !promotes && getLegalMoves(next).length > 0;
  if (continues) {
    return next;
  }

  next.forcedSquare = null;
  next.comboOrigin = null;
  next.comboLandings = null;
  next.lastMove = {
    side: mover.side,
    notation: isJump ? `${origin}x${landings.join("x")}` : `${from}-${to}`,
  };

  const opponent: Side = mover.side === "black" ? "white" : "black";
  next.sideToMove = opponent;
  if (mover.side === "white") {
    next.moveNumber += 1;
  }

  const opponentHasPieces = countPieces(next.pieces, opponent) > 0;
  const opponentHasMoves =
    opponentHasPieces &&
    getLegalMoves({
      ...next,
      sideToMove: opponent,
      forcedSquare: null,
      comboOrigin: null,
      comboLandings: null,
      result: "playing",
    }).length > 0;
  if (!opponentHasPieces || !opponentHasMoves) {
    next.result = mover.side === "black" ? "black-win" : "white-win";
  }

  return next;
}

export function applyNotation(state: GameState, notation: string): GameState {
  const move = getLegalMoves(state).find((candidate) => candidate.notation === notation);
  if (move === undefined) {
    throw new Error(`Not a legal move: ${notation}`);
  }
  let current = state;
  let from = move.from;
  for (const to of move.path) {
    current = applyStep(current, from, to);
    from = to;
  }
  return current;
}

export function declareDraw(state: GameState): GameState {
  if (state.result !== "playing") {
    return state;
  }
  const next = cloneState(state);
  next.result = "draw";
  return next;
}

export function findMove(state: GameState, notation: string): Move | undefined {
  return getLegalMoves(state).find((move) => move.notation === notation);
}

export function serializeGame(state: GameState): SerializedGame {
  const pieces: SerializedGame["pieces"] = {};
  for (let square = 1; square <= 32; square += 1) {
    const piece = state.pieces[square];
    if (piece !== null) {
      pieces[String(square)] = { side: piece.side, king: piece.king };
    }
  }
  return {
    pieces,
    sideToMove: state.sideToMove,
    forcedSquare: state.forcedSquare,
    comboOrigin: state.comboOrigin,
    comboLandings: state.comboLandings,
    moveNumber: state.moveNumber,
    lastMove: state.lastMove,
    capturedByBlack: state.capturedByBlack,
    capturedByWhite: state.capturedByWhite,
    result: state.result,
  };
}

export function deserializeGame(payload: SerializedGame): GameState {
  const pieces = emptyPieces();
  for (const [key, piece] of Object.entries(payload.pieces)) {
    const square = Number(key);
    if (square < 1 || square > 32 || piece === undefined) {
      continue;
    }
    pieces[square] = { side: piece.side, king: piece.king };
  }
  return {
    pieces,
    sideToMove: payload.sideToMove,
    forcedSquare: payload.forcedSquare,
    comboOrigin: payload.comboOrigin,
    comboLandings: payload.comboLandings,
    moveNumber: payload.moveNumber,
    lastMove: payload.lastMove,
    capturedByBlack: payload.capturedByBlack,
    capturedByWhite: payload.capturedByWhite,
    result: payload.result,
  };
}

export function pieceLetter(piece: Piece): string {
  if (piece.side === "black") {
    return piece.king ? "B" : "b";
  }
  return piece.king ? "W" : "w";
}

export function renderDiagram(state: GameState): string {
  const rows: Array<string> = [];
  for (let displayRow = 0; displayRow < 8; displayRow += 1) {
    const rank = 7 - displayRow;
    const cells: Array<string> = [];
    for (let file = 0; file < 8; file += 1) {
      const square = coordToSquare(rank, file);
      if (square === null) {
        cells.push(".");
        continue;
      }
      const piece = state.pieces[square];
      cells.push(piece === null ? "." : pieceLetter(piece));
    }
    rows.push(cells.join(" "));
  }
  return rows.join("\n");
}

export function squareMap(state: GameState): Record<string, string> {
  const map: Record<string, string> = {};
  for (let square = 1; square <= 32; square += 1) {
    const piece = state.pieces[square];
    map[String(square)] = piece === null ? "." : pieceLetter(piece);
  }
  return map;
}

export function pathFromNotation(notation: string): Array<number> {
  const separator = notation.includes("x") ? "x" : "-";
  return notation.split(separator).map((part) => Number(part));
}
