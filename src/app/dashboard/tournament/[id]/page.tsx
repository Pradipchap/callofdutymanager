"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  advanceKnockoutRound,
  calculateStandings,
  canAdvanceKnockout,
  getRoundName,
  isKnockoutComplete,
  knockoutResults,
  leagueCompleted,
  leagueResults,
  setKnockoutWinner,
  setLeagueWinner,
  setThirdPlaceWinner,
} from "@/lib/tournament";
import { KnockoutState, LeagueState, TournamentMode, TournamentRecord } from "@/types/tournament";
import { VoiceRoom } from "@/components/VoiceRoom";

type PageParams = Promise<{ id: string }>;

export default function TournamentDetailPage({ params }: { params: PageParams }) {
  const { id } = use(params);
  const [record, setRecord] = useState<TournamentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/tournaments/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load tournament");
        return;
      }
      setRecord(json);
    }
    load();
  }, [id]);

  async function persist(next: Partial<TournamentRecord>) {
    if (!record) return;
    const res = await fetch(`/api/tournaments/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) return;
    const json = await res.json();
    setRecord(json);
  }

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!record) return <p className="muted">Loading tournament...</p>;

  const isComplete = record.status === "completed";

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <VoiceRoom roomId={record.id} label={record.name} />
      <section className="panel">
        <div className="panel-header">
          <h2>
            {record.name} · {record.mode.toUpperCase()} · {record.status.toUpperCase()}
          </h2>
        </div>
        <div className="panel-body">
          {record.mode === "knockout" ? (
            <KnockoutView
              record={record}
              readOnly={isComplete}
              onPersist={persist}
            />
          ) : (
            <LeagueView record={record} readOnly={isComplete} onPersist={persist} />
          )}
        </div>
      </section>
    </div>
  );
}

function KnockoutView({
  record,
  readOnly,
  onPersist,
}: {
  record: TournamentRecord;
  readOnly: boolean;
  onPersist: (next: Partial<TournamentRecord>) => Promise<void>;
}) {
  const state = (record.state as KnockoutState) ?? null;
  if (!state) return <p className="muted">Missing knockout state.</p>;

  const totalRounds = state.rounds.length;
  const roundName = getRoundName(state.currentRoundIndex, totalRounds);

  async function choose(roundIdx: number, matchIdx: number, key: "p1" | "p2") {
    if (readOnly) return;
    const next = setKnockoutWinner(state, roundIdx, matchIdx, key);
    await onPersist({ state: next });
  }

  async function chooseThird(key: "p1" | "p2") {
    if (readOnly) return;
    const next = setThirdPlaceWinner(state, key);
    await onPersist({ state: next });
  }

  async function nextRound() {
    if (readOnly) return;
    const next = advanceKnockoutRound(state);
    await onPersist({ state: next });
  }

  async function complete() {
    const results = knockoutResults(state, record.players);
    await onPersist({ state, results, status: "completed", completed_at: new Date().toISOString() });
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <p className="muted">{roundName} - choose winners to advance.</p>
      <div className="bracket">
        {state.rounds.map((round, roundIdx) => (
          <div className="round" key={roundIdx}>
            <div className="title">{getRoundName(roundIdx, totalRounds)}</div>
            {round.map((match, matchIdx) => {
              const activeRound = roundIdx === state.currentRoundIndex;
              const clickable = activeRound && !readOnly && match.player1 && match.player2;
              return (
                <div className="match" key={matchIdx}>
                  <div
                    className={`match-player ${clickable ? "clickable" : ""} ${
                      match.winner === match.player1 ? "winner" : ""
                    }`}
                    onClick={() => clickable && choose(roundIdx, matchIdx, "p1")}
                  >
                    <span>{match.player1 ?? "TBD"}</span>
                    <span>{match.winner === match.player1 ? "W" : ""}</span>
                  </div>
                  <div
                    className={`match-player ${clickable ? "clickable" : ""} ${
                      match.winner === match.player2 ? "winner" : ""
                    }`}
                    onClick={() => clickable && choose(roundIdx, matchIdx, "p2")}
                  >
                    <span>{match.player2 ?? "TBD"}</span>
                    <span>{match.winner === match.player2 ? "W" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {state.thirdPlaceMatch ? (
        <div className="panel">
          <div className="panel-header">
            <h2>3RD PLACE MATCH</h2>
          </div>
          <div className="panel-body">
            <div className="match">
              <div
                className={`match-player ${readOnly ? "" : "clickable"} ${
                  state.thirdPlaceMatch.winner === state.thirdPlaceMatch.player1 ? "winner" : ""
                }`}
                onClick={() => !readOnly && chooseThird("p1")}
              >
                <span>{state.thirdPlaceMatch.player1}</span>
                <span>{state.thirdPlaceMatch.winner === state.thirdPlaceMatch.player1 ? "W" : ""}</span>
              </div>
              <div
                className={`match-player ${readOnly ? "" : "clickable"} ${
                  state.thirdPlaceMatch.winner === state.thirdPlaceMatch.player2 ? "winner" : ""
                }`}
                onClick={() => !readOnly && chooseThird("p2")}
              >
                <span>{state.thirdPlaceMatch.player2}</span>
                <span>{state.thirdPlaceMatch.winner === state.thirdPlaceMatch.player2 ? "W" : ""}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!readOnly && canAdvanceKnockout(state) && state.currentRoundIndex < state.rounds.length - 1 ? (
        <button className="btn btn-primary" onClick={nextRound}>
          Advance To Next Round
        </button>
      ) : null}

      {!readOnly && isKnockoutComplete(state) ? (
        <button className="btn btn-primary" onClick={complete}>
          Complete Tournament
        </button>
      ) : null}

      {record.results ? <ResultsPodium results={record.results} mode={record.mode} players={record.players} state={record.state} /> : null}
    </div>
  );
}

function LeagueView({
  record,
  readOnly,
  onPersist,
}: {
  record: TournamentRecord;
  readOnly: boolean;
  onPersist: (next: Partial<TournamentRecord>) => Promise<void>;
}) {
  const state = (record.state as LeagueState) ?? null;
  if (!state) return <p className="muted">Missing league state.</p>;
  const standings = calculateStandings(record.players, state);

  async function choose(matchIdx: number, key: "p1" | "p2") {
    if (readOnly) return;
    const next = setLeagueWinner(state, matchIdx, key);
    await onPersist({ state: next });
  }

  async function complete() {
    const results = leagueResults(record.players, state);
    await onPersist({ state, results, status: "completed", completed_at: new Date().toISOString() });
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="grid-two">
        <section className="panel">
          <div className="panel-header">
            <h2>STANDINGS</h2>
          </div>
          <div className="panel-body">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>P</th>
                  <th>W</th>
                  <th>L</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.name}>
                    <td>{i + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.played}</td>
                    <td>{s.wins}</td>
                    <td>{s.losses}</td>
                    <td>{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>MATCHES</h2>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: "0.5rem" }}>
            {state.matches.map((m, idx) => (
              <div key={`${m.player1}-${m.player2}`} className="league-match">
                <div
                  className={`league-side ${m.winner === m.player1 ? "winner" : ""}`}
                  onClick={() => choose(idx, "p1")}
                >
                  {m.player1}
                </div>
                <div className="muted">VS</div>
                <div
                  className={`league-side ${m.winner === m.player2 ? "winner" : ""}`}
                  onClick={() => choose(idx, "p2")}
                >
                  {m.player2}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!readOnly && leagueCompleted(state) ? (
        <button className="btn btn-primary" onClick={complete}>
          Complete Tournament
        </button>
      ) : null}

      {record.results ? <ResultsPodium results={record.results} mode={record.mode} players={record.players} state={record.state} /> : null}
    </div>
  );
}

function ResultsPodium({
  results,
  mode,
  players,
  state,
}: {
  results: TournamentRecord["results"];
  mode: TournamentMode;
  players: string[];
  state: TournamentRecord["state"];
}) {
  const standings = useMemo(() => {
    if (mode !== "league" || !state) return null;
    return calculateStandings(players, state as LeagueState);
  }, [mode, players, state]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>FINAL RESULTS</h2>
      </div>
      <div className="panel-body">
        <div className="podium">
          <div className="podium-card rank-1">
            <h3>1st Place</h3>
            <p className="title">{results?.champion ?? "-"}</p>
          </div>
          <div className="podium-card rank-2">
            <h3>2nd Place</h3>
            <p className="title">{results?.runnerUp ?? "-"}</p>
          </div>
          <div className="podium-card rank-3">
            <h3>3rd Place</h3>
            <p className="title">{results?.thirdPlace ?? "-"}</p>
          </div>
        </div>

        {standings ? (
          <div style={{ marginTop: "1rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>W</th>
                  <th>L</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.name}>
                    <td>{i + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.wins}</td>
                    <td>{s.losses}</td>
                    <td>{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
