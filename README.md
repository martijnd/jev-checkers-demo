# Checkers vs Jev

Play English / American draughts against [Jev](https://docs.typesafe.ai), TypeSafe's System One model. The app owns the rules and legal moves. Jev only ranks those moves.

## Setup

1. Copy `.env.example` to `.env`
2. Put your [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key in `AI_GATEWAY_API_KEY`
3. `npm install`
4. `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

Node 20+ is required. This demo calls Jev through Vercel AI Gateway with the Vercel AI SDK (`experimental_evaluate`), using model `typesafe-ai/jev`. The key stays on the server; the browser only talks to `/api/jev-move`.

## How it plays

- You are Black, sit at the bottom, and move first.
- Drag a piece to a highlighted square, or click it and then the destination.
- Captures are mandatory. Multi-jumps must continue with the same piece.
- After your turn, Jev scores White's legal moves. The ranking is on the right. The app plays rank 1.
- Click a ranking row to preview that move. Retry if the API call fails; Jev's turn is not skipped.
