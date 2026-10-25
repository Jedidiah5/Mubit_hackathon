"use client";

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
};

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
          </div>
          <p className="btf-edit-hint">
            Click floor to move · arrows nudge · R rotate · Enter place
          </p>
        </div>
      )}

      {editing && toast && (
        <div className="btf-edit-hud__toast" role="status">
          <div className="btf-pill btf-pill--status btf-pill--cannot">{toast}</div>
        </div>
      )}
    </div>
  );
}
