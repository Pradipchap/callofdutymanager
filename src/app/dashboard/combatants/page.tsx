"use client";

import { FormEvent, useEffect, useState } from "react";

interface Combatant {
  id: string;
  name: string;
}

export default function CombatantsPage() {
  const [items, setItems] = useState<Combatant[]>([]);
  const [name, setName] = useState("");
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

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/combatants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save combatant");
      return;
    }
    setName("");
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
          <input
            className="input"
            placeholder="Operator name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
          />
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        <div className="player-list">
          {items.map((item) => (
            <div key={item.id} className="player-item">
              <span style={{ flex: 1 }}>{item.name}</span>
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
