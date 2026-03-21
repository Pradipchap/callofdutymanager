import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const players = Array.isArray(body.players) ? body.players.filter((p: unknown) => typeof p === "string" && p.trim()) : [];
  if (players.length < 2) {
    return NextResponse.json({ error: "A tournament requires at least 2 combatants" }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    name: body.name,
    mode: body.mode,
    status: body.status ?? "active",
    players,
    state: body.state ?? null,
    results: body.results ?? null,
  };

  const { data, error } = await supabase.from("tournaments").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
