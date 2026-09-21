import { deserializeGame } from "@/lib/checkers";
import type { SerializedGame } from "@/lib/checkers";
import { evaluateJevMove, publicErrorMessage } from "@/lib/jev/evaluate-move";

export const runtime = "nodejs";

function isSerializedGame(value: unknown): value is SerializedGame {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<SerializedGame>;
  return (
    typeof candidate.pieces === "object" &&
    candidate.pieces !== null &&
    (candidate.sideToMove === "black" || candidate.sideToMove === "white") &&
    typeof candidate.moveNumber === "number" &&
    Array.isArray(candidate.capturedByBlack) &&
    Array.isArray(candidate.capturedByWhite)
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const payload = typeof body === "object" && body !== null ? (body as { game?: unknown }).game : undefined;
  if (!isSerializedGame(payload)) {
    return Response.json({ error: "Missing or invalid game state." }, { status: 400 });
  }

  try {
    const response = await evaluateJevMove(deserializeGame(payload), request.signal);
    return Response.json(response);
  } catch (error) {
    const message = publicErrorMessage(error);
    const status = message.includes("AI_GATEWAY_API_KEY") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
