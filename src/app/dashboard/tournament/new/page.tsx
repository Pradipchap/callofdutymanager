"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { initKnockout, initLeague } from "@/lib/tournament";
import { TournamentMode } from "@/types/tournament";

interface Combatant {
  id: string;
  name: string;
}

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("OSOK Private Room");
  const [players, setPlayers] = useState<string[]>([]);
  const [playerInput, setPlayerInput] = useState("");
  const [mode, setMode] = useState<TournamentMode>("knockout");
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/combatants")
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json)) setCombatants(json);
      });
  }, []);

  const canStart = useMemo(() => players.length >= 2 && name.trim().length > 0, [name, players.length]);

  function addPlayer(nameValue: string) {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    if (players.includes(trimmed)) return;
    setPlayers((prev) => [...prev, trimmed]);
  }

  function updatePlayer(index: number, value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  async function startTournament(e: FormEvent) {
    e.preventDefault();
    if (!canStart) return;
    setLoading(true);
    setError(null);

    const cleanPlayers = players.map((p) => p.trim()).filter(Boolean);
    const state = mode === "knockout" ? initKnockout(cleanPlayers) : initLeague(cleanPlayers);

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        mode,
        status: "active",
        players: cleanPlayers,
        state,
        results: null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(json.error ?? "Failed to create tournament");
      return;
    }

    const existing = new Set(combatants.map((c) => c.name.toLowerCase()));
    for (const p of cleanPlayers) {
      if (!existing.has(p.toLowerCase())) {
        await fetch("/api/combatants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: p }),
        });
      }
    }

    router.replace(`/dashboard/tournament/${json.id}`);
  }

  return (
    <form className="grid-two" onSubmit={startTournament}>
      <section className="panel">
        <div className="panel-header">
          <h2>TOURNAMENT SETUP</h2>
        </div>
        <div className="panel-body">
          <div className="form-row">
            <label>Tournament Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Add Player</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="input"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                placeholder="Operator..."
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  addPlayer(playerInput);
                  setPlayerInput("");
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div className="player-list">
            {players.map((p, i) => (
              <div className="player-item" key={`${p}-${i}`}>
                <input className="input" value={p} onChange={(e) => updatePlayer(i, e.target.value)} />
                <button type="button" className="btn btn-danger" onClick={() => removePlayer(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="muted">{players.length} players selected</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>MODE & COMBATANTS</h2>
        </div>
        <div className="panel-body">
          <div className="mode-grid" style={{ marginBottom: "1rem" }}>
            <button
              type="button"
              className={`mode-card ${mode === "knockout" ? "selected" : ""}`}
              onClick={() => setMode("knockout")}
            >
              <h3 className="title">KNOCKOUT</h3>
              <small className="muted">Random bracket + 3rd place match</small>
            </button>
            <button
              type="button"
              className={`mode-card ${mode === "league" ? "selected" : ""}`}
              onClick={() => setMode("league")}
            >
              <h3 className="title">POINTS LEAGUE</h3>
              <small className="muted">Round robin, 3 points per win</small>
            </button>
          </div>
          <p className="title" style={{ margin: "0.3rem 0" }}>
            QUICK ADD SAVED COMBATANTS
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {combatants.map((c) => (
              <button type="button" className="btn btn-ghost" key={c.id} onClick={() => addPlayer(c.name)}>
                {c.name}
              </button>
            ))}
          </div>
          {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
          <div style={{ marginTop: "1rem" }}>
            <button className="btn btn-primary" type="submit" disabled={!canStart || loading}>
              {loading ? "Creating..." : "Commence Operation"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
