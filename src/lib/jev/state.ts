import { applyNotation, getLegalMoves, renderDiagram, squareMap } from "@/lib/checkers";
import type { GameState, Move } from "@/lib/checkers";
import { BEST_MOVE_INSTRUCTIONS, DRAUGHTS_RULES, JEV_MODEL } from "./types";
import type { JevGameState, JevMoveSafety, JevRequest } from "./types";

export type { JevGameState, JevRequest };

const CENTER_SQUARES = new Set([14, 15, 18, 19]);

interface AnnotatedMove {
  notation: string;
  description: string;
  safety: JevMoveSafety;
}

function landingSquare(move: Move): number {
  return move.path[move.path.length - 1];
}

function recaptureNet(afterWhiteMove: GameState, blackTake: Move): number {
  const afterTake = applyNotation(afterWhiteMove, blackTake.notation);
  if (afterTake.result === "white-win") {
    return 99;
  }
  if (afterTake.result === "black-win") {
    return -99;
  }
  const recaptures = getLegalMoves(afterTake).filter((move) => move.captured.length > 0);
  const bestWhite =
    recaptures.length === 0 ? 0 : Math.max(...recaptures.map((move) => move.captured.length));
  return bestWhite - blackTake.captured.length;
}

export function annotateMoveForJev(game: GameState, move: Move): AnnotatedMove {
  const after = applyNotation(game, move.notation);
  const landing = landingSquare(move);
  const extras: Array<string> = [];

  if (move.promotes) {
    extras.push("Promotes to king.");
  }
  if (CENTER_SQUARES.has(landing)) {
    extras.push(`Contests center square ${landing}.`);
  }

  const pack = (safety: JevMoveSafety, note: string): AnnotatedMove => ({
    notation: move.notation,
    safety,
    description: [`${safety.toUpperCase()}.`, move.description, note, ...extras].join(" "),
  });

  if (after.result === "white-win") {
    return pack("wins", "WINS: ends the game.");
  }
  if (after.result === "black-win") {
    return pack("material-loss", "MATERIAL-LOSS: loses immediately.");
  }

  const replies = getLegalMoves(after);
  const takesThisPiece = replies.filter((reply) => reply.captured.includes(landing));

  if (takesThisPiece.length === 0) {
    const otherCaptures = replies.some((reply) => reply.captured.length > 0);
    const note = otherCaptures
      ? `SAFE: Black cannot immediately jump the piece on ${landing}, but still has a capture elsewhere.`
      : `SAFE: Black cannot immediately jump the piece on ${landing}.`;
    return pack("safe", note);
  }

  const takeNotations = takesThisPiece.map((reply) => reply.notation).join(", ");
  const worstNet = Math.min(...takesThisPiece.map((reply) => recaptureNet(after, reply)));

  if (worstNet > 0) {
    return pack(
      "exchange",
      `EXCHANGE: Black can take ${landing} (${takeNotations}), then White recaptures extra material.`,
    );
  }
  if (worstNet === 0) {
    return pack(
      "offers-take",
      `OFFERS-TAKE: Black can immediately capture the piece on ${landing} (${takeNotations}). White only recaptures even. Prefer a SAFE developing move instead of offering this take.`,
    );
  }
  if (worstNet <= -2) {
    return pack(
      "material-loss",
      `MATERIAL-LOSS: Black can take the piece on ${landing} (${takeNotations}) and White does not get the material back.`,
    );
  }
  return pack(
    "hangs",
    `HANGS: Black can take the piece on ${landing} immediately (${takeNotations}) with no recapture. Avoid if a SAFE move exists.`,
  );
}

export function buildJevState(game: GameState, legalMoves: Array<Move> = getLegalMoves(game)): JevGameState {
  const diagram = renderDiagram(game);
  return {
    rules: DRAUGHTS_RULES,
    side_to_move: "white",
    you_are: "white",
    board: {
      squares: squareMap(game),
      grid: diagram,
    },
    fen_or_diagram: diagram,
    legal_moves: legalMoves.map((move) => annotateMoveForJev(game, move)),
    last_move: game.lastMove,
    captured_by_black: game.capturedByBlack,
    captured_by_white: game.capturedByWhite,
    move_number: game.moveNumber,
  };
}

export function buildJevRequest(game: GameState, legalMoves: Array<Move> = getLegalMoves(game)): JevRequest {
  const state = buildJevState(game, legalMoves);
  const criteria = Object.fromEntries(state.legal_moves.map((move) => [move.notation, move.description]));
  return {
    model: JEV_MODEL,
    state,
    questions: {
      bestMove: {
        type: "choice" as const,
        instructions: BEST_MOVE_INSTRUCTIONS,
        criteria,
      },
    },
  };
}
