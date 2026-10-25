"use client";

import type { AddableKind } from "@/lib/types";

type Props = {
  editing: boolean;
  onToggle: () => void;
  hasOverrides: boolean;
  onReset: () => void;
  selected: boolean;
  valid: boolean;
  toast: string | null;
  onNudge: (dir: "up" | "down" | "left" | "right") => void;
  onRotate: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  canRemove: boolean;
  onRemove: () => void;
  onAdd: (kind: AddableKind) => void;
  /** Standing note while editing, e.g. "Seats 110 of 120 guests". */
  note: string | null;
};

const ADD_BUTTONS: { kind: AddableKind; label: string }[] = [
  { kind: "sign", label: "+ Sign" },
  { kind: "tv", label: "+ TV screen" },
];

/** DOM overlay: Edit layout toggle, reset, phone-friendly nudge pad, toast. */
export function EditLayoutHud({
  editing,
  onToggle,
  hasOverrides,
  onReset,
  selected,
  valid,
  toast,
  onNudge,
  onRotate,
  onConfirm,
  onCancel,
  canRemove,
  onRemove,
  onAdd,
  note,
}: Props) {
  return (
    <div className="btf-edit-hud">
      <div className="btf-edit-hud__tr">
        <button
          type="button"
          className={`btf-pill btf-pill--btn ${editing ? "is-active" : ""}`}
          onClick={onToggle}
        >
          {editing ? "Done editing" : "Edit layout"}
        </button>
        {editing &&
          ADD_BUTTONS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              className="btf-pill btf-pill--btn"
              onClick={() => onAdd(kind)}
            >
              {label}
            </button>
          ))}
        {editing && hasOverrides && (
          <button
            type="button"
            className="btf-pill btf-pill--btn"
            onClick={onReset}
          >
            Reset layout
          </button>
        )}
      </div>

      {editing && selected && (
        <div className="btf-edit-hud__pad">
          <div className="btf-edit-pad">
            <span className="btf-edit-pad__spacer" />
            <button
              type="button"
              className="btf-icon"
              title="Nudge away (↑)"
              onClick={() => onNudge("up")}
            >
              ↑
            </button>
            <span className="btf-edit-pad__spacer" />
            <button
              type="button"
              className="btf-icon"
              title="Nudge left (←)"
              onClick={() => onNudge("left")}
            >
              ←
            </button>
            <button
              type="button"
              className="btf-icon"
              title="Nudge toward (↓)"
              onClick={() => onNudge("down")}
            >
              ↓
            </button>
            <button
              type="button"
              className="btf-icon"
              title="Nudge right (→)"
              onClick={() => onNudge("right")}
            >
              →
            </button>
            <button
              type="button"
              className="btf-icon"
              title="Rotate 90° (R)"
              onClick={onRotate}
            >
              R
            </button>
            <div className="btf-edit-pad__actions">
              <button
                type="button"
                className="btf-pill btf-pill--btn"
                disabled={!valid}
                onClick={onConfirm}
                title="Confirm (Enter)"
              >
                Place
              </button>
              <button
                type="button"
                className="btf-pill btf-pill--btn"
                onClick={onCancel}
                title="Cancel (Esc)"
              >
                Esc
              </button>
            </div>
            {canRemove && (
              <div className="btf-edit-pad__actions">
                <button
                  type="button"
                  className="btf-pill btf-pill--btn btf-pill--danger"
                  onClick={onRemove}
                  title="Delete (Del)"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <p className="btf-edit-hint">
            Click floor to move · arrows nudge · R rotate · Enter place · Del
            delete
          </p>
        </div>
      )}

      {editing && (toast || note) && (
        <div className="btf-edit-hud__toast" role="status">
          {toast && (
            <div className="btf-pill btf-pill--status btf-pill--cannot">
              {toast}
            </div>
          )}
          {note && <div className="btf-pill btf-pill--dark">{note}</div>}
        </div>
      )}
    </div>
  );
}
