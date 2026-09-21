import { createGateway, experimental_evaluate } from "ai";
import type { JSONObject } from "@ai-sdk/provider";
import { findMove, getLegalMoves } from "@/lib/checkers";
import type { GameState } from "@/lib/checkers";
import { usageFromTokens } from "./cost";
import { buildJevRequest } from "./state";
import { JEV_MODEL } from "./types";
import type { JevMoveResponse, RankedMove } from "./types";

function readConfidence(metadata: unknown, questionId: string): number | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }
  const typesafe = (metadata as { typesafe?: { confidence?: Record<string, number> } }).typesafe;
  const value = typesafe?.confidence?.[questionId];
  return typeof value === "number" ? value : null;
}

export function publicErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Jev request failed.";
  }
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      return parsed.message;
    }
  } catch {
    // Not JSON; use the original message.
  }
  return error.message;
}

function getGateway() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      "Missing AI_GATEWAY_API_KEY. Copy .env.example to .env and add your Vercel AI Gateway key.",
    );
  }
  return createGateway({ apiKey });
}

export async function evaluateJevMove(
  game: GameState,
  abortSignal?: AbortSignal,
): Promise<JevMoveResponse> {
  if (game.sideToMove !== "white" || game.result !== "playing") {
    throw new Error("Jev is only called on White's turn while the game is in progress.");
  }

  const legalMoves = getLegalMoves(game);
  if (legalMoves.length === 0) {
    throw new Error("No legal moves for Jev in this position.");
  }

  const request = buildJevRequest(game, legalMoves);
  const started = Date.now();

  const result = await experimental_evaluate({
    model: getGateway().evaluationModel(JEV_MODEL),
    state: request.state as unknown as JSONObject,
    questions: request.questions,
    abortSignal,
  });

  const latencyMs = Date.now() - started;
  const answer = result.answers.bestMove;
  const probabilities = answer.probabilities ?? { [answer.choice]: 1 };
  const legalSet = new Set(legalMoves.map((move) => move.notation));
  const ranked: Array<RankedMove> = Object.entries(probabilities)
    .sort((left, right) => right[1] - left[1])
    .map(([notation, probability], index) => {
      const move = findMove(game, notation);
      return {
        rank: index + 1,
        notation,
        probability,
        from: move?.from ?? Number(notation.split(/[-x]/)[0]),
        path: move?.path ?? [],
      };
    });

  const selected =
    ranked.find((entry) => legalSet.has(entry.notation)) ??
    ranked.find((entry) => entry.notation === answer.choice && legalSet.has(entry.notation));

  if (selected === undefined || !legalSet.has(selected.notation)) {
    throw new Error("Jev did not return a legal move. Retry the position.");
  }

  const confidence = readConfidence(result.providerMetadata, "bestMove");
  const model = result.response.modelId || JEV_MODEL;
  const usage = usageFromTokens({
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });

  return {
    selectedMove: selected.notation,
    ranked,
    confidence,
    model,
    latencyMs,
    usage,
    raw: {
      choice: answer.choice,
      probabilities,
      confidence,
      usage,
      model,
    },
    request,
  };
}
