import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrganization } from "@/lib/supabase/get-organization";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const org = await getOrCreateOrganization(supabase, user.id, user.email || undefined);
  if (!org) return NextResponse.json([], { status: 500 });

  const { searchParams } = new URL(request.url);
  const agentSlug = searchParams.get("agent_slug");
  const clientId = searchParams.get("client_id");

  const adminDb = createAdminClient();

  let query = adminDb
    .from("conversations")
    .select("id, title, agent_slug, client_id, status, created_at, updated_at")
    .eq("organization_id", org.organizationId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (agentSlug) query = query.eq("agent_slug", agentSlug);
  if (clientId) query = query.eq("client_id", clientId);

  const { data: conversations, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last message preview for each conversation
  const convIds = (conversations || []).map((c) => c.id);
  let previews: Record<string, string> = {};

  if (convIds.length > 0) {
    // Get the latest user or assistant message per conversation
    const { data: msgs } = await adminDb
      .from("messages")
      .select("conversation_id, content, role")
      .in("conversation_id", convIds)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false });

    if (msgs) {
      for (const msg of msgs) {
        if (!previews[msg.conversation_id] && msg.content) {
          previews[msg.conversation_id] = msg.content.slice(0, 100);
        }
      }
    }
  }

  const result = (conversations || []).map((c) => ({
    ...c,
    preview: previews[c.id] || "",
  }));

  return NextResponse.json(result);
}
