import type { CaptureKind, LastMove } from "@/lib/checkers";
import type { JevUsage } from "./cost";

export const JEV_MODEL = "typesafe-ai/jev";

export const BEST_MOVE_INSTRUCTIONS =
  "You are White in English draughts (American checkers). Pick the strongest legal option. Read each option's safety tag first. HANGS means Black can take that piece next turn for free: almost never play it when a SAFE alternative exists. MATERIAL-LOSS means Black nets extra pieces: never play it unless every option loses. OFFERS-TAKE means Black can immediately capture the piece you just moved and you only recapture even: do not play this when a SAFE developing move exists. EXCHANGE means you recapture extra material: that is good. SAFE means Black cannot immediately jump the piece you just moved: prefer these. WINS ends the game. Priorities: 1) captures that gain material or a king, 2) SAFE developing moves that improve structure (center squares 14, 15, 18, 19, mutually supporting men, advancing a trailing man), 3) never move a man onto a square Black can immediately jump just to occupy a square, even if that square looks central and even if you can recapture even, 4) promote only when the landing is not a free take. Never pick an illegal move.";

export const DRAUGHTS_RULES =
  "English draughts (American checkers): 8x8 board, play on dark squares numbered 1-32. Black moves first from the bottom; White plays from the top. Men move one diagonal step forward and capture by jumping an adjacent opponent onto the empty dark square immediately beyond. Kings move and capture forward and backward; no flying kings. Captures are mandatory. If the same piece can jump again, it must continue. A man that lands on the opponent back rank promotes to a king and that jump sequence stops. Win by leaving the opponent with no pieces or no legal move.";

export type JevMoveSafety = "wins" | "safe" | "hangs" | "offers-take" | "exchange" | "material-loss";

export interface JevGameState {
  rules: string;
  side_to_move: "white";
  you_are: "white";
  board: {
    squares: Record<string, string>;
    grid: string;
  };
  fen_or_diagram: string;
  legal_moves: Array<{
    notation: string;
    description: string;
    safety: JevMoveSafety;
  }>;
  last_move: LastMove | null;
  captured_by_black: Array<CaptureKind>;
  captured_by_white: Array<CaptureKind>;
  move_number: number;
}

export interface JevRequest {
  model: string;
  state: JevGameState;
  questions: {
    bestMove: {
      type: "choice";
      instructions: string;
      criteria: Record<string, string>;
    };
  };
}

export interface RankedMove {
  rank: number;
  notation: string;
  probability: number;
  from: number;
  path: Array<number>;
}

export interface JevMoveResponse {
  selectedMove: string;
  ranked: Array<RankedMove>;
  confidence: number | null;
  model: string;
  latencyMs: number;
  usage: JevUsage;
  raw: {
    choice: string;
    probabilities: Record<string, number>;
    confidence: number | null;
    usage: JevUsage;
    model: string;
  };
  request: JevRequest;
}
