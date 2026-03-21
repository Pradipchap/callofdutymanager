import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data) return NextResponse.json(data);

  const fallbackName = user.user_metadata?.display_name || user.email?.split("@")[0] || "operator";
  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      display_name: fallbackName,
      avatar_url: null,
    })
    .select("id, email, display_name, avatar_url, created_at")
    .single();

  if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });
  return NextResponse.json(created);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const displayNameRaw = body.display_name;
  const displayName = displayNameRaw === undefined ? undefined : String(displayNameRaw ?? "").trim();
  const avatarUrl = body.avatar_url ? String(body.avatar_url) : null;

  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...(displayName !== undefined ? { display_name: displayName } : {}),
      avatar_url: avatarUrl,
    })
    .eq("id", user.id)
    .select("id, email, display_name, avatar_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
