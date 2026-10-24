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

const fieldClass =
  "w-full border border-[color:var(--line)] bg-transparent px-2.5 py-1.5 font-mono text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--ink)]";
const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/45";

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
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink)]">
        Spec
      </p>

      <label className="block">
        <span className={labelClass}>Style</span>
        <select
          className={fieldClass}
          value={spec.style}
          onChange={(e) => onChange("style", e.target.value as Style)}
        >
          {STYLES.map((s) => (
            <option key={s} value={s} className="bg-[color:var(--background)]">
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Guests</span>
        <input
          type="number"
          min={1}
          max={1000}
          className={fieldClass}
          value={guestsDraft}
          onChange={(e) => onGuestsDraft(e.target.value)}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Stage</span>
        <select
          className={fieldClass}
          value={spec.stage}
          onChange={(e) => onChange("stage", e.target.value as Wall)}
        >
          {WALLS.map((w) => (
            <option key={w} value={w} className="bg-[color:var(--background)]">
              {w}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Bar</span>
        <select
          className={fieldClass}
          value={spec.bar}
          onChange={(e) => onChange("bar", e.target.value as Wall)}
        >
          {WALLS.map((w) => (
            <option key={w} value={w} className="bg-[color:var(--background)]">
              {w}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className={labelClass}>Extras</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {EXTRAS.map((extra) => (
            <label
              key={extra}
              className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[color:var(--ink)]/85"
            >
              <input
                type="checkbox"
                checked={spec.extras.includes(extra)}
                onChange={() => toggleExtra(extra)}
                className="accent-[color:var(--ink)]"
              />
              {EXTRA_LABEL[extra]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center justify-between gap-3 border border-[color:var(--line)] px-2.5 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/45">
          Accessible
        </span>
        <input
          type="checkbox"
          checked={spec.accessible}
          onChange={(e) => onChange("accessible", e.target.checked)}
          className="accent-[color:var(--ink)]"
        />
      </label>
    </div>
  );
}
