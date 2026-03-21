"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TournamentRecord } from "@/types/tournament";

export default function DashboardPage() {
  const [items, setItems] = useState<TournamentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/tournaments");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load tournaments");
        return;
      }
      setItems(json);
    }
    load();
  }, []);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>MY TOURNAMENTS</h2>
      </div>
      <div className="panel-body">
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        {items.length === 0 ? (
          <p className="muted">No tournaments yet. Start your first operation.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {items.map((t) => (
              <div key={t.id} className="player-item">
                <div style={{ flex: 1 }}>
                  <div className="title" style={{ fontSize: "1.2rem" }}>
                    {t.name}
                  </div>
                  <small className="muted">
                    {t.mode.toUpperCase()} · {t.status.toUpperCase()} · {new Date(t.created_at).toLocaleString()}
                  </small>
                </div>
                <Link href={`/dashboard/tournament/${t.id}`} className="btn btn-primary">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
