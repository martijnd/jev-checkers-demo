"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    const copyWithFallback = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus({ preventScroll: true });
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    };

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => {
        copyWithFallback();
      });
      return;
    }
    copyWithFallback();
  }, [text]);

  return (
    <button type="button" className={className ?? "btn-icon"} onClick={onCopy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function formatJson(value: unknown, emptyText: string): string {
  if (value == null) {
    return emptyText;
  }
  return JSON.stringify(value, null, 2);
}

export function JsonToolbar({
  text,
  onFullscreen,
  fullscreenLabel = "Fullscreen",
}: {
  text: string;
  onFullscreen: () => void;
  fullscreenLabel?: string;
}) {
  return (
    <div className="json-toolbar">
      <CopyButton text={text} />
      <button type="button" className="btn-icon" onClick={onFullscreen}>
        {fullscreenLabel}
      </button>
    </div>
  );
}

export function JsonPreview({ text }: { text: string }) {
  return <pre className="json-pre">{text}</pre>;
}

interface JsonFullscreenProps {
  requestText: string | null;
  responseText: string | null;
  initialTab: "request" | "response";
  onClose: () => void;
}

export function JsonFullscreen({
  requestText,
  responseText,
  initialTab,
  onClose,
}: JsonFullscreenProps) {
  const headingId = useId();
  const [tab, setTab] = useState<"request" | "response">(initialTab);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const activeText =
    tab === "request"
      ? (requestText ?? "No request yet.")
      : (responseText ?? "No response yet.");

  return createPortal(
    <div className="json-modal-root" role="presentation" onClick={onClose}>
      <div
        className="json-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="json-modal-header">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-gold/80 uppercase">
              System One JSON
            </p>
            <h2 id={headingId} className="font-display text-2xl text-cream">
              {tab === "request" ? "Request JSON" : "Response JSON"}
            </h2>
          </div>
          <div className="json-toolbar">
            <CopyButton text={activeText} />
            <button type="button" className="btn-icon" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className="json-tabs" role="tablist" aria-label="JSON payload">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "request"}
            className={tab === "request" ? "json-tab json-tab-active" : "json-tab"}
            onClick={() => setTab("request")}
          >
            Request
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "response"}
            className={tab === "response" ? "json-tab json-tab-active" : "json-tab"}
            onClick={() => setTab("response")}
          >
            Response
          </button>
        </div>
        <pre className="json-modal-pre">{activeText}</pre>
      </div>
    </div>,
    document.body,
  );
}
