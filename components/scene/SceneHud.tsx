"use client";

import { isTight } from "@/lib/feasibility";
import type { FeasibilityStatus, Room } from "@/lib/types";

export type SceneHudProps = {
  /** e.g. "Banquet · 120 guests" */
  subtitle?: string;
  status?: FeasibilityStatus;
  used?: number;
  capacity?: number;
  /** Small footer line, e.g. model + latency. */
  footnote?: string;
  /** Hide everything except view controls. */
  minimal?: boolean;
};

type Props = SceneHudProps & {
  room: Room;
  planView: boolean;
  onPlanViewChange?: (plan: boolean) => void;
  onRotate: (dir: 1 | -1) => void;
  onFit: () => void;
};

const STATUS_LABEL: Record<FeasibilityStatus, string> = {
  fits: "Fits",
  warning: "Needs a change",
  cannot: "Can't host",
};

export function SceneHud({
  room,
  subtitle,
  status,
  used,
  capacity,
  footnote,
  minimal,
  planView,
  onPlanViewChange,
  onRotate,
  onFit,
}: Props) {
  const pct =
    used != null && capacity != null && capacity > 0
      ? Math.min(100, Math.round((used / capacity) * 100))
      : null;
  const tight =
    status === "fits" &&
    used != null &&
    capacity != null &&
    isTight(used, capacity);

  return (
    <div className="btf-hud" aria-hidden={false}>
      {!minimal && (
        <div className="btf-hud__tl">
          <div className="btf-pill btf-pill--lg btf-pop">
            <span className="btf-pill__title">{room.name}</span>
            <span className="btf-pill__meta">
              {room.widthM} × {room.lengthM} m
              {subtitle ? ` · ${subtitle}` : ""}
            </span>
          </div>
          {status && (
            <div
              className={`btf-pill btf-pill--status btf-pill--${status} btf-pop`}
              style={{ animationDelay: "60ms" }}
            >
              <span className="btf-dot" />
              <span>
                {STATUS_LABEL[status]}
                {tight && <span className="btf-pill__tight"> · tight</span>}
              </span>
              {pct != null && (
                <span className="btf-pill__gauge">
                  <span className="btf-pill__gauge-bar">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="btf-pill__gauge-text">
                    {used}/{capacity}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="btf-hud__br">
        <div className="btf-hud__stack">
          <button
            type="button"
            className="btf-icon"
            title="Rotate left"
            onClick={() => onRotate(1)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
          <button
            type="button"
            className="btf-icon"
            title="Rotate right"
            onClick={() => onRotate(-1)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 4v5h-5" />
            </svg>
          </button>
          <button
            type="button"
            className="btf-icon"
            title="Fit to view"
            onClick={onFit}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
        {onPlanViewChange && (
          <button
            type="button"
            className={`btf-pill btf-pill--btn ${planView ? "is-active" : ""}`}
            onClick={() => onPlanViewChange(!planView)}
          >
            {planView ? "Isometric" : "Plan view"}
          </button>
        )}
      </div>

      {!minimal && footnote && (
        <div className="btf-hud__bl">
          <div className="btf-pill btf-pill--sm">{footnote}</div>
        </div>
      )}

      {!minimal && (
        <div className="btf-hud__bc">
          <div className="btf-pill btf-pill--sm btf-legend">
            <span><i style={{ background: "#f7f2e8", border: "1px solid #bbb" }} /> Tables</span>
            <span><i style={{ background: "#2f2f2f" }} /> Stage</span>
            <span><i style={{ background: "#5b3b22" }} /> Bar</span>
            <span><i style={{ background: "#c9ccd1", border: "1px solid #999" }} /> Buffet</span>
            <span><i className="btf-legend__checker" /> Dance</span>
            <span><i style={{ background: "#d04545" }} /> Overflow</span>
            <span><i style={{ background: "#7eb6d9" }} /> Access</span>
          </div>
        </div>
      )}
    </div>
  );
}
