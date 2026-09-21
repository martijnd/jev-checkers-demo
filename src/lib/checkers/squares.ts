export const BOARD_SIZE = 8;
export const SQUARE_COUNT = 32;

export interface Coord {
  rank: number;
  file: number;
}

export function isDarkSquare(rank: number, file: number): boolean {
  if (rank < 0 || rank > 7 || file < 0 || file > 7) {
    return false;
  }
  return rank % 2 === 0 ? file % 2 === 1 : file % 2 === 0;
}

export function squareToCoord(square: number): Coord {
  if (square < 1 || square > SQUARE_COUNT) {
    throw new Error(`Square ${square} is out of range`);
  }
  const index = square - 1;
  const rank = Math.floor(index / 4);
  const indexFromLeft = index % 4;
  const file = rank % 2 === 0 ? indexFromLeft * 2 + 1 : indexFromLeft * 2;
  return { rank, file };
}

export function coordToSquare(rank: number, file: number): number | null {
  if (!isDarkSquare(rank, file)) {
    return null;
  }
  const indexFromLeft = Math.floor(file / 2);
  return rank * 4 + indexFromLeft + 1;
}

export function displayRowToRank(displayRow: number): number {
  return 7 - displayRow;
}

export function rankToDisplayRow(rank: number): number {
  return 7 - rank;
}

export function jumpedSquare(from: number, to: number): number {
  const start = squareToCoord(from);
  const end = squareToCoord(to);
  const midRank = (start.rank + end.rank) / 2;
  const midFile = (start.file + end.file) / 2;
  if (!Number.isInteger(midRank) || !Number.isInteger(midFile)) {
    throw new Error(`No midpoint between ${from} and ${to}`);
  }
  const mid = coordToSquare(midRank, midFile);
  if (mid === null) {
    throw new Error(`Invalid jump from ${from} to ${to}`);
  }
  return mid;
}

export function isKingRank(square: number, side: "black" | "white"): boolean {
  const { rank } = squareToCoord(square);
  return side === "black" ? rank === 7 : rank === 0;
}
