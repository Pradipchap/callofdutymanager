import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("combatants")
    .select("id, user_id, combatant_user_id, name, created_at")
    .neq("combatant_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = [...new Set((data ?? []).map((c) => c.combatant_user_id).filter(Boolean))];
  const { data: profileRows } = ids.length
    ? await supabase.from("profiles").select("id, email, display_name, avatar_url").in("id", ids)
    : { data: [] };
  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const payload = (data ?? []).map((c) => ({
    ...c,
    profile: profileMap.get(c.combatant_user_id) ?? null,
  }));

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const combatantUserIdFromBody = String(body.combatantUserId ?? "").trim();
  const lookup = String(body.lookup ?? "").trim();

  let combatantUserId = combatantUserIdFromBody;

  if (!combatantUserId && lookup) {
    const normalized = lookup.toLowerCase();
    const { data: byEmail, error: byEmailError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .limit(2);
    if (byEmailError) return NextResponse.json({ error: byEmailError.message }, { status: 400 });
    if ((byEmail ?? []).length === 1) {
      combatantUserId = byEmail![0].id;
    } else {
      const { data: byName, error: byNameError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", lookup)
        .limit(2);
      if (byNameError) return NextResponse.json({ error: byNameError.message }, { status: 400 });
      if ((byName ?? []).length === 1) {
        combatantUserId = byName![0].id;
      }
    }
  }

  if (!combatantUserId) {
    return NextResponse.json(
      { error: "Select a registered user from suggestions, or type an exact email/username" },
      { status: 400 },
    );
  }

  if (combatantUserId === user.id) {
    return NextResponse.json({ error: "You cannot add yourself as a combatant" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", combatantUserId)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if (!profile) return NextResponse.json({ error: "Only registered users can be added" }, { status: 400 });

  const name = profile.display_name?.trim() || profile.email.split("@")[0];
  const { data, error } = await supabase
    .from("combatants")
    .upsert(
      { name, user_id: user.id, combatant_user_id: profile.id },
      { onConflict: "user_id,combatant_user_id", ignoreDuplicates: false },
    )
    .select("id, user_id, combatant_user_id, name, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ...data, profile });
}
