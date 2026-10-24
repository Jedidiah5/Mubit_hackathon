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
import { AppNav } from "@/components/AppNav";
import { DEMO_VENUE, DEMO_VENUE_ID, type RoomDoc } from "@/lib/data/venue";
import { getDb } from "@/lib/firebase";
import { ensureDemoRoomsSeeded } from "@/lib/seed-rooms";
import type { Room, Style } from "@/lib/types";
import { STYLES } from "@/lib/types";

const inputClass =
  "w-full border border-[color:var(--line)] bg-transparent px-2.5 py-1.5 font-mono text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--ink)]";
const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/45";

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

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
        <header className="mb-10 space-y-4 border-b border-[color:var(--line)] pb-6">
          <AppNav current="/setup" />
          <div>
            <h1 className="font-sans text-3xl tracking-tight">Venue setup</h1>
            <p className="mt-2 font-mono text-xs text-[color:var(--ink)]/45">
              Demo rooms · seeded once from lib/data/venue.ts
            </p>
          </div>
        </header>

        {error && (
          <p className="mb-6 border border-[color:var(--cannot)]/40 bg-[color:var(--cannot)]/10 px-4 py-3 font-mono text-xs text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <label className="mb-8 block max-w-md">
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
              className="shrink-0 bg-[color:var(--ink)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--panel-2)]"
            >
              Save
            </button>
          </div>
        </label>

        {!ready && (
          <p className="font-mono text-sm text-[color:var(--ink)]/40">Loading rooms…</p>
        )}

        <div className="space-y-8">
          {rooms.map((room) => (
            <article
              key={room.id}
              className="border border-[color:var(--line)] p-5"
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
                      className="accent-[#c8ff00]"
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

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveRoom(room)}
                  disabled={savingId === room.id}
                  className="bg-[color:var(--ink)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--panel-2)] disabled:opacity-50"
                >
                  {savingId === room.id ? "Saving…" : "Save room"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
