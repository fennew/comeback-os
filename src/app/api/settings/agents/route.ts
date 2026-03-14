import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrganization } from "@/lib/supabase/get-organization";

// GET — fetch all agent configs for the user's org
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrganization(supabase, user.id, user.email || undefined);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 500 });

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("agent_configs")
    .select("slug, model, max_tokens, system_prompt")
    .eq("organization_id", org.organizationId);

  return NextResponse.json(data || []);
}

// PUT — update model for a specific agent
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrganization(supabase, user.id, user.email || undefined);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 500 });

  const body = await request.json();
  const { slug, model, system_prompt } = body;

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const adminDb = createAdminClient();

  // Build upsert data
  const upsertData: Record<string, unknown> = {
    organization_id: org.organizationId,
    slug,
  };
  if (model) upsertData.model = model;
  if (system_prompt !== undefined) upsertData.system_prompt = system_prompt;

  // Upsert agent config
  const { error } = await adminDb
    .from("agent_configs")
    .upsert(upsertData, { onConflict: "organization_id,slug" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
