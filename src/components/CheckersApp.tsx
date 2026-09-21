'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { Board } from '@/components/Board';
import { JevPanel } from '@/components/JevPanel';
import {
  applyStep,
  createInitialState,
  declareDraw,
  pathFromNotation,
  serializeGame,
} from '@/lib/checkers';
import type { CaptureKind, GameState, Piece } from '@/lib/checkers';
import { buildJevRequest } from '@/lib/jev/state';
import type { JevMoveResponse, JevRequest } from '@/lib/jev/types';

type JevStatus = 'idle' | 'thinking' | 'animating' | 'ready' | 'error';

interface JevUiState {
  status: JevStatus;
  request: JevRequest | null;
  response: JevMoveResponse | null;
  error: string | null;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function turnLabel(game: GameState, jev: JevUiState): string {
  if (jev.status === 'thinking') {
    return 'Jev is thinking…';
  }
  if (jev.status === 'animating') {
    return 'Jev is moving…';
  }
  if (jev.status === 'error') {
    return 'Jev could not move';
  }
  if (game.result === 'black-win') {
    return 'You win';
  }
  if (game.result === 'white-win') {
    return 'Jev wins';
  }
  if (game.result === 'draw') {
    return 'Draw';
  }
  if (game.forcedSquare !== null) {
    return 'Keep jumping';
  }
  if (game.sideToMove === 'black') {
    return 'Your turn';
  }
  return 'Jev to move';
}

function MiniPiece({ piece }: { piece: Piece }) {
  return (
    <span
      className={[
        'mini-piece',
        piece.side === 'black' ? 'mini-black' : 'mini-jev',
      ].join(' ')}
    >
      {piece.king ? '♛' : ''}
    </span>
  );
}

function capturedAsPieces(
  side: 'black' | 'white',
  kinds: Array<CaptureKind>,
): Array<Piece> {
  return kinds.map((kind) => ({ side, king: kind === 'king' }));
}

export function CheckersApp() {
  const [game, setGame] = useState<GameState>(createInitialState);
  const [selected, setSelected] = useState<number | null>(null);
  const [previewNotation, setPreviewNotation] = useState<string | null>(null);
  const [jev, setJev] = useState<JevUiState>({
    status: 'idle',
    request: null,
    response: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const lastPath =
    game.lastMove === null ? null : pathFromNotation(game.lastMove.notation);
  const previewMove = jev.response?.ranked.find(
    (move) => move.notation === previewNotation,
  );
  const previewPath =
    previewMove === undefined ? null : [previewMove.from, ...previewMove.path];
  const boardLocked =
    game.result !== 'playing' ||
    game.sideToMove !== 'black' ||
    jev.status === 'thinking' ||
    jev.status === 'animating' ||
    jev.status === 'error';

  const requestJev = useCallback(async (position: GameState) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewNotation(null);
    const request = buildJevRequest(position);
    setJev({ status: 'thinking', request, response: null, error: null });

    try {
      const result = await fetch('/api/jev-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: serializeGame(position) }),
        signal: controller.signal,
      });
      const payload: unknown = await result.json();
      if (!result.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : 'Jev request failed.';
        throw new Error(message);
      }
      const data = payload as JevMoveResponse;
      const rankedMove = data.ranked.find(
        (move) => move.notation === data.selectedMove,
      );
      if (rankedMove === undefined) {
        throw new Error('Jev returned a move that is not in the ranking.');
      }

      const confirmedRequest = data.request ?? request;
      setJev({
        status: 'animating',
        request: confirmedRequest,
        response: data,
        error: null,
      });
      let current = position;
      let from = rankedMove.from;
      for (const [index, to] of rankedMove.path.entries()) {
        if (index > 0) {
          await delay(420, controller.signal);
        } else {
          await delay(180, controller.signal);
        }
        current = applyStep(current, from, to);
        setGame(current);
        from = to;
      }
      setSelected(null);
      setJev({
        status: 'ready',
        request: confirmedRequest,
        response: data,
        error: null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Jev request failed.';
      setJev({ status: 'error', request, response: null, error: message });
    }
  }, []);

  const onMove = useCallback(
    (from: number, to: number) => {
      setPreviewNotation(null);
      let next: GameState;
      try {
        next = applyStep(game, from, to);
      } catch {
        return;
      }
      setGame(next);
      setSelected(next.forcedSquare);
      if (next.sideToMove === 'white' && next.result === 'playing') {
        void requestJev(next);
      }
    },
    [game, requestJev],
  );

  const onNewGame = useCallback(() => {
    abortRef.current?.abort();
    setGame(createInitialState());
    setSelected(null);
    setPreviewNotation(null);
    setJev({ status: 'idle', request: null, response: null, error: null });
  }, []);

  const capturedByYou = useMemo(
    () => capturedAsPieces('white', game.capturedByBlack),
    [game.capturedByBlack],
  );
  const capturedByJev = useMemo(
    () => capturedAsPieces('black', game.capturedByWhite),
    [game.capturedByWhite],
  );

  return (
    <div className='app-shell'>
      <div className='app-frame'>
        <section className='board-column'>
          <header className='mb-5 flex shrink-0 items-end justify-between gap-4'>
            <div>
              <p className='text-[11px] font-semibold tracking-[0.24em] text-gold/80 uppercase'>
                English draughts
              </p>
              <h1 className='font-display text-4xl text-cream'>
                Checkers vs Jev
              </h1>
              <p className='mt-1 text-sm text-cream/60'>
                You are Black. Jev plays Red as System One.
              </p>
            </div>
            <div className='flex gap-2'>
              <button
                type='button'
                className='btn-secondary'
                onClick={() => {
                  abortRef.current?.abort();
                  setJev((current) =>
                    current.status === 'thinking' || current.status === 'error'
                      ? {
                          status: 'idle',
                          request: current.request,
                          response: current.response,
                          error: null,
                        }
                      : current,
                  );
                  setGame(declareDraw(game));
                }}
                disabled={game.result !== 'playing'}
              >
                Draw
              </button>
              <button type='button' className='btn-primary' onClick={onNewGame}>
                New game
              </button>
            </div>
          </header>

          <div className='status-row shrink-0'>
            <span
              className={jev.status === 'thinking' ? 'text-gold' : 'text-cream'}
            >
              {turnLabel(game, jev)}
            </span>
            {game.lastMove !== null ? (
              <span className='font-mono text-cream/55'>
                Last: {game.lastMove.side === 'black' ? 'you' : 'Jev'}{' '}
                {game.lastMove.notation}
              </span>
            ) : (
              <span className='text-cream/40'>Black moves first</span>
            )}
          </div>

          <div className='captured-row shrink-0'>
            <div className='flex items-center gap-2'>
              <span className='text-xs tracking-wide text-cream/45 uppercase'>
                You captured
              </span>
              <div className='flex gap-1'>
                {capturedByYou.length === 0 ? (
                  <span className='text-cream/25'>—</span>
                ) : (
                  capturedByYou.map((piece, index) => (
                    <MiniPiece key={`you-${index}`} piece={piece} />
                  ))
                )}
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <span className='text-xs tracking-wide text-cream/45 uppercase'>
                Jev captured
              </span>
              <div className='flex gap-1'>
                {capturedByJev.length === 0 ? (
                  <span className='text-cream/25'>—</span>
                ) : (
                  capturedByJev.map((piece, index) => (
                    <MiniPiece key={`jev-${index}`} piece={piece} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className='board-stage'>
            <Board
              game={game}
              selected={selected}
              lastPath={lastPath}
              previewPath={previewPath}
              disabled={boardLocked}
              onSelect={setSelected}
              onMove={onMove}
              onInteraction={() => setPreviewNotation(null)}
            />
          </div>
        </section>

        <JevPanel
          turnLabel={turnLabel(game, jev)}
          thinking={jev.status === 'thinking'}
          request={jev.request}
          response={jev.response}
          error={jev.error}
          previewNotation={previewNotation}
          playedNotation={jev.response?.selectedMove ?? null}
          onPreview={setPreviewNotation}
          onRetry={() => {
            if (game.sideToMove === 'white' && game.result === 'playing') {
              void requestJev(game);
            }
          }}
        />
      </div>
    </div>
  );
}
