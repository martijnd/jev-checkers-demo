import { describe, expect, it } from "vitest";
import { applyNotation, createInitialState, getLegalMoves, stateFromPosition } from "../checkers";
import { JEV_MODEL } from "./types";
import { annotateMoveForJev, buildJevRequest } from "./state";

describe("buildJevRequest", () => {
  it("packages the position, Choice question, and legal White moves", () => {
    const afterBlack = applyNotation(createInitialState(), "11-15");
    const legalMoves = getLegalMoves(afterBlack);
    const request = buildJevRequest(afterBlack, legalMoves);

    expect(request.model).toBe(JEV_MODEL);
    expect(request.state.side_to_move).toBe("white");
    expect(request.state.last_move).toEqual({ notation: "11-15", side: "black" });
    expect(request.questions.bestMove.type).toBe("choice");
    expect(request.questions.bestMove.instructions).toMatch(/OFFERS-TAKE/);
    expect(request.questions.bestMove.criteria["22-18"]).toMatch(/^OFFERS-TAKE\./);
    expect(request.questions.bestMove.criteria["21-17"]).toMatch(/^SAFE\./);
    expect(request.state.legal_moves.find((move) => move.notation === "22-18")?.safety).toBe(
      "offers-take",
    );
    expect(request.state.legal_moves.find((move) => move.notation === "21-17")?.safety).toBe("safe");

    const notations = legalMoves.map((move) => move.notation).sort();
    expect(Object.keys(request.questions.bestMove.criteria).sort()).toEqual(notations);
    expect(request.state.legal_moves.map((move) => move.notation).sort()).toEqual(notations);
    expect(request.state.fen_or_diagram).toContain("b");
    expect(request.state.fen_or_diagram).toContain("w");
  });

  it("labels a free take as HANGS when White cannot recapture", () => {
    const game = stateFromPosition({
      blackMen: [15],
      whiteMen: [22, 32],
      sideToMove: "white",
    });
    const hang = getLegalMoves(game).find((move) => move.notation === "22-18");
    expect(hang).toBeDefined();
    const annotated = annotateMoveForJev(game, hang!);
    expect(annotated.safety).toBe("hangs");
    expect(annotated.description).toMatch(/^HANGS\./);
  });
});
