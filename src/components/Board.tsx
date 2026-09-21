"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  coordToSquare,
  displayRowToRank,
  getImmediateDestinations,
  isDarkSquare,
} from "@/lib/checkers";
import type { GameState, Piece } from "@/lib/checkers";

interface BoardProps {
  game: GameState;
  selected: number | null;
  lastPath: Array<number> | null;
  previewPath: Array<number> | null;
  disabled: boolean;
  onSelect: (square: number | null) => void;
  onMove: (from: number, to: number) => void;
  onInteraction: () => void;
}

interface DragState {
  from: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  legal: Array<number>;
}

function Crown({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.5 17.5 5 8l5 5 2-7 2 7 5-5 1.5 9.5zM5 19h14v1.8H5z"
      />
    </svg>
  );
}

function PieceView({
  piece,
  selected,
}: {
  piece: Piece;
  selected?: boolean;
}) {
  const isBlack = piece.side === "black";
  return (
    <div
      className={[
        "piece",
        isBlack ? "piece-black" : "piece-jev",
        selected ? "piece-selected" : "",
      ].join(" ")}
    >
      {piece.king ? <Crown className={isBlack ? "crown-gold" : "crown-cream"} /> : null}
    </div>
  );
}

function squareFromElement(target: EventTarget | null): number | null {
  const attr =
    target instanceof Element ? target.closest("[data-square]")?.getAttribute("data-square") : null;
  if (attr === null || attr === undefined) {
    return null;
  }
  return Number(attr);
}

function squareFromPoint(clientX: number, clientY: number): number | null {
  return squareFromElement(document.elementFromPoint(clientX, clientY));
}

export function Board({
  game,
  selected,
  lastPath,
  previewPath,
  disabled,
  onSelect,
  onMove,
  onInteraction,
}: BoardProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedOnDownRef = useRef(false);
  const legalFromSelected =
    selected === null ? [] : getImmediateDestinations(game, selected);
  const legalSet = new Set(legalFromSelected);
  const lastSet = new Set(lastPath ?? []);
  const previewSet = new Set(previewPath ?? []);
  const previewTo = previewPath !== null && previewPath.length > 0 ? previewPath[previewPath.length - 1] : null;
  const previewFrom = previewPath !== null && previewPath.length > 0 ? previewPath[0] : null;
  const previewPiece =
    previewFrom !== null ? (game.pieces[previewFrom] ?? game.pieces[previewTo ?? 0] ?? null) : null;

  function canControl(square: number): boolean {
    if (disabled || game.result !== "playing" || game.sideToMove !== "black") {
      return false;
    }
    const piece = game.pieces[square];
    if (piece === null || piece.side !== "black") {
      return false;
    }
    if (game.forcedSquare !== null && square !== game.forcedSquare) {
      return false;
    }
    return getImmediateDestinations(game, square).length > 0;
  }

  function onBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const square = squareFromElement(event.target);
    onInteraction();
    if (disabled) {
      return;
    }
    if (square === null) {
      onSelect(null);
      return;
    }
    if (selected !== null && legalSet.has(square)) {
      movedOnDownRef.current = true;
      dragRef.current = null;
      setDrag(null);
      onMove(selected, square);
      return;
    }
    if (!canControl(square)) {
      if (!legalSet.has(square)) {
        onSelect(null);
      }
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    movedOnDownRef.current = false;
    onSelect(square);
    const nextDrag = {
      from: square,
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      legal: getImmediateDestinations(game, square),
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function onBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag === null) {
      return;
    }
    setDrag((current) => {
      if (current === null) {
        return current;
      }
      const next = { ...current, x: event.clientX, y: event.clientY };
      dragRef.current = next;
      return next;
    });
  }

  function onBoardPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (movedOnDownRef.current) {
      movedOnDownRef.current = false;
      dragRef.current = null;
      setDrag(null);
      return;
    }
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (current === null) {
      return;
    }
    const to = squareFromPoint(event.clientX, event.clientY);
    if (to !== null && current.legal.includes(to) && to !== current.from) {
      onMove(current.from, to);
    }
  }

  const isDragging =
    drag !== null && Math.hypot(drag.x - drag.originX, drag.y - drag.originY) > 8;

  const squares = [];
  for (let displayRow = 0; displayRow < 8; displayRow += 1) {
    const rank = displayRowToRank(displayRow);
    for (let file = 0; file < 8; file += 1) {
      const square = coordToSquare(rank, file);
      const dark = isDarkSquare(rank, file);
      const piece = square === null ? null : game.pieces[square];
      const isSelected = square !== null && square === selected;
      const isLegal = square !== null && legalSet.has(square);
      const inLast = square !== null && lastSet.has(square);
      const inPreview = square !== null && previewSet.has(square);
      const showGhost = square === previewTo && previewPiece !== null && (piece === null || square === previewFrom);
      squares.push(
        <div
          key={`${displayRow}-${file}`}
          role={square === null ? undefined : "button"}
          aria-label={square === null ? undefined : `Square ${square}`}
          data-square={square ?? undefined}
          className={[
            "relative aspect-square",
            dark ? "bg-felt" : "bg-maple",
            inLast ? "last-square" : "",
            inPreview ? "preview-square" : "",
            isSelected ? "selected-square" : "",
          ].join(" ")}
        >
          {square !== null && dark ? (
            <span className="square-index">{square}</span>
          ) : null}
          {isLegal ? <span className="legal-dot" /> : null}
          {piece !== null && !(isDragging && drag.from === square) ? (
            <PieceView piece={piece} selected={isSelected} />
          ) : null}
          {showGhost && previewPiece !== null ? (
            <div className="absolute inset-[12%] opacity-45">
              <PieceView piece={previewPiece} />
            </div>
          ) : null}
        </div>,
      );
    }
  }

  return (
    <div
      className="board-frame"
      onPointerDown={onBoardPointerDown}
      onPointerMove={onBoardPointerMove}
      onPointerUp={onBoardPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        setDrag(null);
      }}
    >
      <div className="board-grid cursor-pointer select-none touch-none">
        {squares}
      </div>
      {isDragging && drag !== null ? (
        <div
          className="pointer-events-none fixed z-50 h-16 w-16 -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.x, top: drag.y }}
        >
          {game.pieces[drag.from] !== null ? <PieceView piece={game.pieces[drag.from]!} /> : null}
        </div>
      ) : null}
    </div>
  );
}
