"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-wrap">
      <section className="panel auth-card">
        <div className="panel-header">
          <h2>LOGIN</h2>
        </div>
        <form className="panel-body" onSubmit={onSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="muted">
            No account? <Link href="/register">Create one</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
