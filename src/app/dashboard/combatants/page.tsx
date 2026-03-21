"use client";

import { FormEvent, useEffect, useState } from "react";

interface Combatant {
  id: string;
  name: string;
  combatant_user_id: string;
  profile?: {
    id: string;
    email: string;
    display_name: string | null;
  } | null;
}

interface UserSuggestion {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function CombatantsPage() {
  const [items, setItems] = useState<Combatant[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/combatants");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load combatants");
      return;
    }
    setItems(json);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
      const json = await res.json();
      if (res.ok && Array.isArray(json)) setSuggestions(json);
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const lookup = query.trim();
    if (!selectedUser && !lookup) return;
    setError(null);
    const res = await fetch("/api/combatants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        combatantUserId: selectedUser?.id ?? null,
        lookup,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save combatant");
      return;
    }
    setQuery("");
    setSelectedUser(null);
    setSuggestions([]);
    setItems((prev) => [json, ...prev]);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/combatants/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>SAVED COMBATANTS</h2>
      </div>
      <div className="panel-body">
        <form onSubmit={create} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              className="input"
              placeholder="Type username or email..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedUser(null);
                setError(null);
              }}
            />
            {suggestions.length > 0 && !selectedUser ? (
              <div className="suggestion-list">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="suggestion-item"
                    onClick={() => {
                      setSelectedUser(s);
                      setQuery(s.display_name?.trim() || s.email);
                      setSuggestions([]);
                    }}
                  >
                    <img src={s.avatar_url ?? "/avatar-placeholder.svg"} alt="" className="avatar-sm" />
                    <span style={{ textAlign: "left" }}>
                      <strong>{s.display_name?.trim() || s.email.split("@")[0]}</strong>
                      <small className="muted" style={{ display: "block" }}>
                        {s.email}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button className="btn btn-primary" type="submit" disabled={!selectedUser && !query.trim()}>
            Save
          </button>
        </form>
        <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "0.75rem" }}>
          Tip: choose a suggestion, or type exact email/username and press Save.
        </p>
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        <div className="player-list">
          {items.map((item) => (
            <div key={item.id} className="player-item">
              <div style={{ flex: 1 }}>
                <div>{item.profile?.display_name?.trim() || item.name}</div>
                <small className="muted">{item.profile?.email ?? "Registered user"}</small>
              </div>
              <button className="btn btn-danger" onClick={() => remove(item.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
