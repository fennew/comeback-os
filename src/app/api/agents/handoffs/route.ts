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
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");

  const adminDb = createAdminClient();

  let query = adminDb
    .from("agent_handoffs")
    .select("*")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch recent completed tasks with results
  let taskQuery = adminDb
    .from("tasks")
    .select("*")
    .eq("organization_id", org.organizationId)
    .not("result", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (clientId) taskQuery = taskQuery.eq("client_id", clientId);

  const { data: tasks } = await taskQuery;

  return NextResponse.json({
    handoffs: data || [],
    tasks: tasks || [],
  });
}
