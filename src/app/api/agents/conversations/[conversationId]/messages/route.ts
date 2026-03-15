import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrganization } from "@/lib/supabase/get-organization";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const org = await getOrCreateOrganization(supabase, user.id, user.email || undefined);
  if (!org) return NextResponse.json([], { status: 500 });

  const { conversationId } = await params;
  const adminDb = createAdminClient();

  // Verify conversation belongs to user's org
  const { data: conv } = await adminDb
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: messages, error } = await adminDb
    .from("messages")
    .select("id, role, content, tool_calls, tool_call_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(messages || []);
}
