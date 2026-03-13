import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateOrganization } from "@/lib/supabase/get-organization";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    // Get single client
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  // Get all clients for user's organization
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, logo_url, industry, status, monthly_retainer, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get or auto-create user's organization
  const org = await getOrCreateOrganization(supabase, user.id, user.email || undefined);

  if (!org) {
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }

  const membership = { organization_id: org.organizationId };

  const body = await request.json();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: membership.organization_id,
      name: body.name,
      industry: body.industry,
      website: body.website,
      brand_voice: body.brand_voice,
      brand_colors: body.brand_colors,
      notes: body.notes,
      monthly_retainer: body.monthly_retainer,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
