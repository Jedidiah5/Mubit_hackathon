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
  /** Denser floating island for the enquiry canvas. */
  compact?: boolean;
};

export function SpecForm({
  spec,
  onChange,
  guestsDraft,
  onGuestsDraft,
  compact = false,
}: Props) {
  function toggleExtra(extra: Extra) {
    const has = spec.extras.includes(extra);
    const next = has
      ? spec.extras.filter((e) => e !== extra)
      : [...spec.extras, extra];
    onChange("extras", next);
  }

  if (compact) {
    return (
      <div className="nb-panel space-y-2.5 bg-[color:var(--panel-snow)]/92 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ink)]">
            Spec
          </p>
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
            <input
              type="checkbox"
              checked={spec.accessible}
              onChange={(e) => onChange("accessible", e.target.checked)}
              className="size-3.5 accent-[color:var(--ink)]"
            />
            Accessible
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block min-w-0">
            <span className="nb-label !mb-1">Style</span>
            <select
              className="nb-input !px-2 !py-2 !text-[12px]"
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
          <label className="block min-w-0">
            <span className="nb-label !mb-1">Guests</span>
            <input
              type="number"
              min={1}
              max={1000}
              className="nb-input !px-2 !py-2 !text-[12px]"
              value={guestsDraft}
              onChange={(e) => onGuestsDraft(e.target.value)}
            />
          </label>
          <label className="block min-w-0">
            <span className="nb-label !mb-1">Stage</span>
            <select
              className="nb-input !px-2 !py-2 !text-[12px]"
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
          <label className="block min-w-0">
            <span className="nb-label !mb-1">Bar</span>
            <select
              className="nb-input !px-2 !py-2 !text-[12px]"
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
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXTRAS.map((extra) => {
            const on = spec.extras.includes(extra);
            return (
              <button
                key={extra}
                type="button"
                onClick={() => toggleExtra(extra)}
                className={`rounded-full border-2 border-[color:var(--ink)] px-2.5 py-1 font-sans text-[11px] font-bold ${
                  on
                    ? "bg-[color:var(--accent)] shadow-[2px_2px_0_0_#151515]"
                    : "bg-[color:var(--panel-snow)]"
                }`}
              >
                {EXTRA_LABEL[extra]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="nb-panel space-y-3 bg-[color:var(--panel-snow)]/92 p-4 backdrop-blur-md">
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
        <div className="grid grid-cols-2 gap-2">
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
