"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AppHeader() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="top-nav">
      <div>
        <h1 className="title" style={{ margin: 0 }}>
          CALL OF DUTY <span style={{ color: "var(--primary)" }}>MOBILE</span>
        </h1>
        <small className="muted">ONE SHOT ONE KILL TOURNAMENT MANAGER</small>
      </div>
      <div className="nav-links">
        <Link href="/dashboard" className="btn btn-ghost">
          Dashboard
        </Link>
        <Link href="/dashboard/combatants" className="btn btn-ghost">
          Combatants
        </Link>
        <Link href="/dashboard/profile" className="btn btn-ghost">
          Profile
        </Link>
        <Link href="/dashboard/tournament/new" className="btn btn-primary">
          New Tournament
        </Link>
        <button className="btn btn-danger" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
