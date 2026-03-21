"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { initKnockout, initLeague } from "@/lib/tournament";
import { TournamentMode } from "@/types/tournament";

interface Combatant {
  id: string;
  name: string;
  combatant_user_id: string;
  profile?: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
}

interface SelectedPlayer {
  id: string;
  name: string;
}

interface CurrentProfile {
  id: string;
  email: string;
  display_name: string | null;
}

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("OSOK Private Room");
  const [players, setPlayers] = useState<SelectedPlayer[]>([]);
  const [mode, setMode] = useState<TournamentMode>("knockout");
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/combatants")
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setCombatants(json);
        } else {
          setError(json?.error ?? "Failed to load combatants");
        }
      })
      .catch(() => {
        setError("Failed to load combatants");
      });
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (!json?.id) return;
        const me: CurrentProfile = {
          id: json.id,
          email: json.email,
          display_name: json.display_name,
        };
        setCurrentProfile(me);
        const myName = (me.display_name?.trim() || me.email.split("@")[0]).trim();
        setPlayers((prev) => {
          if (prev.some((p) => p.id === me.id)) return prev;
          return [{ id: me.id, name: myName }, ...prev];
        });
      })
      .catch(() => {
        // Keep page usable if profile load fails.
      });
  }, []);

  const canStart = useMemo(() => players.length >= 2 && name.trim().length > 0, [name, players.length]);

  function addPlayerFromCombatant(combatant: Combatant) {
    const label = (combatant.profile?.display_name?.trim() || combatant.name).trim();
    if (!label) return;
    if (players.some((p) => p.id === combatant.combatant_user_id)) return;
    setPlayers((prev) => [...prev, { id: combatant.combatant_user_id, name: label }]);
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  async function startTournament(e: FormEvent) {
    e.preventDefault();
    if (!canStart) return;
    setLoading(true);
    setError(null);

    const cleanPlayers = players.map((p) => p.name.trim()).filter(Boolean);
    const usedNames = new Map<string, number>();
    const normalizedPlayers = cleanPlayers.map((playerName) => {
      const count = usedNames.get(playerName) ?? 0;
      usedNames.set(playerName, count + 1);
      return count === 0 ? playerName : `${playerName} (${count + 1})`;
    });
    const state = mode === "knockout" ? initKnockout(normalizedPlayers) : initLeague(normalizedPlayers);

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        mode,
        status: "active",
        players: normalizedPlayers,
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
          <p className="muted">
            Players can only be selected from saved combatants (registered users).
          </p>
          <p className="muted">
            {currentProfile ? "Your profile is auto-added. Add at least one more combatant." : "Loading your profile..."}
          </p>
          <div className="player-list">
            {players.map((p, i) => (
              <div className="player-item" key={`${p.id}-${i}`}>
                <span style={{ flex: 1 }}>{p.name}</span>
                <button type="button" className="btn btn-danger" onClick={() => removePlayer(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="muted">{players.length} players selected (minimum 2 required)</p>
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
              <button type="button" className="btn btn-ghost" key={c.id} onClick={() => addPlayerFromCombatant(c)}>
                {c.profile?.display_name?.trim() || c.name}
              </button>
            ))}
          </div>
          {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
          {!canStart ? <p className="muted">Add at least 2 combatants to start.</p> : null}
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
