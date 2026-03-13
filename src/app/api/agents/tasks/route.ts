import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const agentSlug = searchParams.get("agent_slug");
  const clientId = searchParams.get("client_id");

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (agentSlug) query = query.eq("agent_slug", agentSlug);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await request.json();
  const { title, description, agent_slug, client_id, priority, due_date } = body;

  if (!title || !agent_slug) {
    return NextResponse.json({ error: "Missing title or agent_slug" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: membership.organization_id,
      title,
      description: description || null,
      agent_slug,
      client_id: client_id || null,
      priority: priority || "medium",
      due_date: due_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

  updates.updated_at = new Date().toISOString();
  if (updates.status === "in_progress" && !updates.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (updates.status === "completed" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
