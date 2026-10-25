"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { DEMO_VENUE, DEMO_VENUE_ID, type RoomDoc } from "@/lib/data/venue";
import { getDb } from "@/lib/firebase";
import { ensureDemoRoomsSeeded } from "@/lib/seed-rooms";
import { DEMO_EXTRAS_PRICING } from "@/lib/data/venue";
import type { Room, RoomPricing, Style } from "@/lib/types";
import { STYLES } from "@/lib/types";

const inputClass = "nb-input !py-2 !text-sm";
const labelClass = "nb-label";

const EXTRA_FIELD_LABEL: Record<keyof RoomPricing["extras"], string> = {
  dance_floor: "Dance floor",
  dj_booth: "DJ booth",
  photo_booth: "Photo booth",
  projector: "Projector",
  lectern: "Lectern",
  buffet_per_head: "Buffet / head",
};

function defaultPricing(): RoomPricing {
  return {
    hireFee: 0,
    perHead: { banquet: 0, cabaret: 0, theatre: 0, reception: 0 },
    extras: { ...DEMO_EXTRAS_PRICING },
    minSpend: 0,
  };
}

export default function SetupPage() {
  const [rooms, setRooms] = useState<RoomDoc[]>([]);
  const [venueName, setVenueName] = useState(DEMO_VENUE.name);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    void (async () => {
      try {
        const db = getDb();
        await ensureDemoRoomsSeeded(db);
        unsub = onSnapshot(
          query(collection(db, "rooms"), where("venueId", "==", DEMO_VENUE_ID)),
          (snap) => {
            const next = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Room),
            }));
            next.sort((a, b) => b.widthM * b.lengthM - a.widthM * a.lengthM);
            setRooms(next);
            setReady(true);
          },
          (err) => setError(err.message),
        );
        onSnapshot(doc(db, "venues", DEMO_VENUE_ID), (snap) => {
          if (snap.exists()) {
            setVenueName(String(snap.data().name ?? DEMO_VENUE.name));
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Seed failed");
      }
    })();
    return () => unsub();
  }, []);

  const saveRoom = useCallback(async (room: RoomDoc) => {
    setSavingId(room.id);
    setError(null);
    try {
      const { id, ...data } = room;
      await updateDoc(doc(getDb(), "rooms", id), data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }, []);

  const saveVenueName = useCallback(async () => {
    try {
      await updateDoc(doc(getDb(), "venues", DEMO_VENUE_ID), {
        name: venueName.trim() || DEMO_VENUE.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Venue save failed");
    }
  }, [venueName]);

  function patchRoom(id: string, patch: Partial<Room>) {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function patchCapacity(id: string, style: Style, value: number) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, capacity: { ...r.capacity, [style]: value } }
          : r,
      ),
    );
  }

  function patchPricing(id: string, patch: Partial<RoomPricing>) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const pricing = { ...(r.pricing ?? defaultPricing()), ...patch };
        return { ...r, pricing };
      }),
    );
  }

  function patchPerHead(id: string, style: Style, value: number) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const pricing = r.pricing ?? defaultPricing();
        return {
          ...r,
          pricing: {
            ...pricing,
            perHead: { ...pricing.perHead, [style]: value },
          },
        };
      }),
    );
  }

  function patchExtraFee(
    id: string,
    key: keyof RoomPricing["extras"],
    value: number,
  ) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const pricing = r.pricing ?? defaultPricing();
        return {
          ...r,
          pricing: {
            ...pricing,
            extras: { ...pricing.extras, [key]: value },
          },
        };
      }),
    );
  }

  return (
    <PageShell>
        <PageHeader
          current="/setup"
          title="Setup"
          subtitle="The Wharf Rooms · demo rooms from lib/data/venue.ts"
          actions={
            <button
              type="button"
              onClick={() => void saveVenueName()}
              className="nb-btn nb-btn-ink"
            >
              Save venue name
            </button>
          }
        />

        {error && (
          <p className="nb-banner nb-banner-bad mb-6 font-mono text-xs font-bold text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <label className="nb-panel mb-8 block max-w-md p-4">
          <span className={labelClass}>Venue name</span>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void saveVenueName()}
              className="nb-btn nb-btn-ink shrink-0 !min-h-0 !px-3 !py-2 !text-[10px]"
            >
              Save
            </button>
          </div>
        </label>

        {!ready && (
          <p className="font-mono text-sm text-[color:var(--muted)]">Loading rooms…</p>
        )}

        <div className="space-y-6">
          {rooms.map((room) => (
            <article
              key={room.id}
              className="nb-panel p-5"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-sans text-xl tracking-tight">{room.name}</h2>
                <span className="font-mono text-[10px] text-[color:var(--ink)]/35">
                  {room.id}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Name</span>
                  <input
                    className={inputClass}
                    value={room.name}
                    onChange={(e) =>
                      patchRoom(room.id, { name: e.target.value })
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Width (m)</span>
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      className={inputClass}
                      value={room.widthM}
                      onChange={(e) =>
                        patchRoom(room.id, {
                          widthM: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Length (m)</span>
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      className={inputClass}
                      value={room.lengthM}
                      onChange={(e) =>
                        patchRoom(room.id, {
                          lengthM: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              <p className={`${labelClass} mt-5`}>Capacity by style</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STYLES.map((style) => (
                  <label key={style} className="block">
                    <span className={labelClass}>{style}</span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={room.capacity[style]}
                      onChange={(e) =>
                        patchCapacity(
                          room.id,
                          style,
                          Number.parseInt(e.target.value, 10) || 0,
                        )
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-4 font-sans text-sm">
                {(
                  [
                    ["stepFree", "Step-free"],
                    ["hasStage", "Stage"],
                    ["hasAV", "AV / projector"],
                    ["hasBar", "Bar"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-[color:var(--ink)]"
                      checked={room[key]}
                      onChange={(e) =>
                        patchRoom(room.id, { [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              <label className="mt-5 block">
                <span className={labelClass}>Rules (one per line)</span>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={room.rules.join("\n")}
                  onChange={(e) =>
                    patchRoom(room.id, {
                      rules: e.target.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>

              {(() => {
                const pricing = room.pricing ?? defaultPricing();
                return (
                  <div className="mt-6 space-y-4 border-t border-[color:var(--line)] pt-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Pricing (£, ex-VAT)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className={labelClass}>Hire fee</span>
                        <input
                          type="number"
                          min={0}
                          step={50}
                          className={inputClass}
                          value={pricing.hireFee}
                          onChange={(e) =>
                            patchPricing(room.id, {
                              hireFee: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={labelClass}>Minimum spend</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          className={inputClass}
                          value={pricing.minSpend}
                          onChange={(e) =>
                            patchPricing(room.id, {
                              minSpend: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>

                    <p className={`${labelClass} !mb-2`}>Per head by style</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {STYLES.map((style) => (
                        <label key={style} className="block">
                          <span className={labelClass}>{style}</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={inputClass}
                            value={pricing.perHead[style]}
                            onChange={(e) =>
                              patchPerHead(
                                room.id,
                                style,
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>

                    <p className={`${labelClass} !mb-2`}>Extras</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(
                        [
                          "dance_floor",
                          "dj_booth",
                          "photo_booth",
                          "projector",
                          "lectern",
                          "buffet_per_head",
                        ] as const
                      ).map((key) => (
                        <label key={key} className="block">
                          <span className={labelClass}>
                            {EXTRA_FIELD_LABEL[key]}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={inputClass}
                            value={pricing.extras[key]}
                            onChange={(e) =>
                              patchExtraFee(
                                room.id,
                                key,
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveRoom(room)}
                  disabled={savingId === room.id}
                  className="nb-btn nb-btn-ink !min-h-0 !px-4 !py-2 !text-[10px]"
                >
                  {savingId === room.id ? "Saving…" : "Save room"}
                </button>
              </div>
            </article>
          ))}
        </div>
    </PageShell>
  );
}
