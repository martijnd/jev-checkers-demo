export type Side = "black" | "white";
export type Result = "playing" | "black-win" | "white-win" | "draw";
export type CaptureKind = "man" | "king";

export interface Piece {
  side: Side;
  king: boolean;
}

export interface LastMove {
  notation: string;
  side: Side;
}

export interface GameState {
  pieces: Array<Piece | null>;
  sideToMove: Side;
  forcedSquare: number | null;
  comboOrigin: number | null;
  comboLandings: Array<number> | null;
  moveNumber: number;
  lastMove: LastMove | null;
  capturedByBlack: Array<CaptureKind>;
  capturedByWhite: Array<CaptureKind>;
  result: Result;
}

export interface Move {
  from: number;
  path: Array<number>;
  captured: Array<number>;
  notation: string;
  description: string;
  promotes: boolean;
}

export interface SerializedGame {
  pieces: Record<string, { side: Side; king: boolean }>;
  sideToMove: Side;
  forcedSquare: number | null;
  comboOrigin: number | null;
  comboLandings: Array<number> | null;
  moveNumber: number;
  lastMove: LastMove | null;
  capturedByBlack: Array<CaptureKind>;
  capturedByWhite: Array<CaptureKind>;
  result: Result;
}
