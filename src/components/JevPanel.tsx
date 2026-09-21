"use client";

import type { JevMoveResponse, JevRequest } from "@/lib/jev/types";

interface JevPanelProps {
  turnLabel: string;
  thinking: boolean;
  request: JevRequest | null;
  response: JevMoveResponse | null;
  error: string | null;
  previewNotation: string | null;
  playedNotation: string | null;
  onPreview: (notation: string | null) => void;
  onRetry: () => void;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="h-4 w-5 rounded bg-white/8" />
          <div className="h-4 w-16 rounded bg-white/8" />
          <div className="skeleton-bar h-2 flex-1 rounded-full" style={{ animationDelay: `${index * 70}ms` }} />
        </div>
      ))}
    </div>
  );
}

function SentToJev({ request }: { request: JevRequest }) {
  const options = Object.entries(request.questions.bestMove.criteria);

  return (
    <section className="mt-6 border-t border-gold/15 pt-4">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-cream/70 uppercase">Sent to Jev</h3>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-cream/45">Model</dt>
          <dd className="font-mono text-cream/90">{request.model}</dd>
        </div>
        <div>
          <dt className="text-cream/45">Question</dt>
          <dd className="mt-1 leading-6 text-cream/80">{request.questions.bestMove.instructions}</dd>
        </div>
        <div>
          <dt className="text-cream/45">Choice options ({options.length})</dt>
          <dd>
            <ul className="mt-2 flex flex-col gap-1.5">
              {options.map(([notation, description]) => (
                <li key={notation} className="font-mono text-[12px] leading-5 text-cream/80">
                  <span className="text-gold">{notation}</span>
                  <span className="text-cream/40"> - </span>
                  <span className="font-sans text-cream/70">{description}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-cream/45">Board</dt>
          <dd>
            <pre className="mt-2 overflow-auto rounded-md bg-black/40 p-3 font-mono text-[11px] leading-5 text-cream/85">
              {request.state.fen_or_diagram}
            </pre>
          </dd>
        </div>
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs tracking-wide text-cream/50 uppercase">
          Full request JSON
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-black/40 p-3 font-mono text-[11px] leading-5 text-cream/80">
          {JSON.stringify(request, null, 2)}
        </pre>
      </details>
    </section>
  );
}

export function JevPanel({
  turnLabel,
  thinking,
  request,
  response,
  error,
  previewNotation,
  playedNotation,
  onPreview,
  onRetry,
}: JevPanelProps) {
  const topMoves = response?.ranked.slice(0, 10) ?? [];

  return (
    <aside className="jev-panel flex h-full min-h-0 flex-col">
      <header className="border-b border-gold/20 px-5 py-4">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold/80 uppercase">
          TypeSafe System One
        </p>
        <div className="mt-2 flex items-center gap-2">
          {thinking ? <span className="pulse-dot" /> : null}
          <h2 className="font-display text-2xl text-cream">{turnLabel}</h2>
        </div>
        {response !== null && !thinking ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-cream/45">Selected move</dt>
              <dd className="font-mono text-lg text-gold">{response.selectedMove}</dd>
            </div>
            <div>
              <dt className="text-cream/45">Confidence</dt>
              <dd className="text-lg text-cream">
                {response.confidence === null ? "—" : formatPercent(response.confidence)}
              </dd>
            </div>
            <div>
              <dt className="text-cream/45">Model</dt>
              <dd className="font-mono text-cream/90">{response.model}</dd>
            </div>
            <div>
              <dt className="text-cream/45">Response speed</dt>
              <dd className="font-mono text-cream/90">{response.latencyMs} ms</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-cream/45">Tokens</dt>
              <dd className="font-mono text-cream/80">
                {response.usage.input_tokens === undefined && response.usage.output_tokens === undefined
                  ? "Not reported"
                  : `${response.usage.input_tokens ?? "—"} in / ${response.usage.output_tokens ?? "—"} out`}
              </dd>
            </div>
          </dl>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-cream/70 uppercase">Top 10 moves</h3>
        {thinking ? <SkeletonRows /> : null}
        {!thinking && error !== null ? (
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 p-4">
            <p className="text-sm break-words text-red-100">{error}</p>
            <button type="button" className="btn-retry mt-3" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}
        {!thinking && error === null && response === null ? (
          <p className="text-sm leading-6 text-cream/65">
            Jev scores the legal moves from this position. It does not invent moves or write
            commentary. After you move, the app sends White&apos;s options as a Choice question and
            plays Jev&apos;s highest-probability legal move.
          </p>
        ) : null}
        {!thinking && error === null && response !== null ? (
          <ol className="flex flex-col gap-1">
            {topMoves.map((move) => {
              const isPlayed = move.notation === playedNotation;
              const isPreview = move.notation === previewNotation;
              return (
                <li key={move.notation}>
                  <button
                    type="button"
                    onClick={() => onPreview(isPreview ? null : move.notation)}
                    className={[
                      "rank-row",
                      isPlayed ? "rank-row-played" : "",
                      isPreview ? "rank-row-preview" : "",
                    ].join(" ")}
                  >
                    <span className="w-6 text-right font-mono text-cream/50">{move.rank}</span>
                    <span className="w-[5.5rem] font-mono text-cream">{move.notation}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-gold"
                        style={{ width: `${Math.max(move.probability * 100, 1.5)}%` }}
                      />
                    </span>
                    <span className="w-14 text-right font-mono text-sm text-cream/80">
                      {formatPercent(move.probability)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}
        {request != null ? <SentToJev request={request} /> : null}
      </div>

      <footer className="border-t border-gold/20 px-5 py-3">
        <details>
          <summary className="cursor-pointer text-xs tracking-wide text-cream/50 uppercase">
            Raw System One response
          </summary>
          <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-black/40 p-3 font-mono text-[11px] leading-5 text-cream/80">
            {response === null ? "No response yet." : JSON.stringify(response.raw, null, 2)}
          </pre>
        </details>
      </footer>
    </aside>
  );
}
