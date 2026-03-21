import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .or(`email.ilike.${pattern},display_name.ilike.${pattern}`)
    .neq("id", user.id)
    .limit(8);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}
