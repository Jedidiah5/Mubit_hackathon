"use client";

import { EXTRAS, STYLES, WALLS, type Extra, type Spec, type Style, type Wall } from "@/lib/types";

const EXTRA_LABEL: Record<Extra, string> = {
  dance_floor: "Dance floor",
  dj_booth: "DJ booth",
  projector: "Projector",
  lectern: "Lectern",
  buffet: "Buffet",
  photo_booth: "Photo booth",
};

type Props = {
  spec: Spec;
  onChange: <K extends keyof Spec>(field: K, value: Spec[K]) => void;
  guestsDraft: string;
  onGuestsDraft: (value: string) => void;
};

export function SpecForm({
  spec,
  onChange,
  guestsDraft,
  onGuestsDraft,
}: Props) {
  function toggleExtra(extra: Extra) {
    const has = spec.extras.includes(extra);
    const next = has
      ? spec.extras.filter((e) => e !== extra)
      : [...spec.extras, extra];
    onChange("extras", next);
  }

  return (
    <div className="nb-panel space-y-3 p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ink)]">
        Spec
      </p>

      <label className="block">
        <span className="nb-label">Style</span>
        <select
          className="nb-input"
          value={spec.style}
          onChange={(e) => onChange("style", e.target.value as Style)}
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="nb-label">Guests</span>
        <input
          type="number"
          min={1}
          max={1000}
          className="nb-input"
          value={guestsDraft}
          onChange={(e) => onGuestsDraft(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="nb-label">Stage</span>
        <select
          className="nb-input"
          value={spec.stage}
          onChange={(e) => onChange("stage", e.target.value as Wall)}
        >
          {WALLS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="nb-label">Bar</span>
        <select
          className="nb-input"
          value={spec.bar}
          onChange={(e) => onChange("bar", e.target.value as Wall)}
        >
          {WALLS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="nb-label">Extras</legend>
        <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-2">
          {EXTRAS.map((extra) => {
            const on = spec.extras.includes(extra);
            return (
              <button
                key={extra}
                type="button"
                onClick={() => toggleExtra(extra)}
                className={`rounded-[var(--radius-sm)] border-2 border-[color:var(--ink)] px-2.5 py-2 text-left font-mono text-[11px] font-bold ${
                  on
                    ? "bg-[color:var(--accent)] shadow-[2px_2px_0_0_#111]"
                    : "bg-[color:var(--panel-2)]"
                }`}
              >
                {EXTRA_LABEL[extra]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label
        className={`flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-sm)] border-2 border-[color:var(--ink)] px-3 py-2.5 ${
          spec.accessible
            ? "bg-[color:var(--accent-3)]"
            : "bg-[color:var(--panel-2)]"
        }`}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
          Accessible
        </span>
        <input
          type="checkbox"
          checked={spec.accessible}
          onChange={(e) => onChange("accessible", e.target.checked)}
          className="size-5 accent-[color:var(--ink)]"
        />
      </label>
    </div>
  );
}
