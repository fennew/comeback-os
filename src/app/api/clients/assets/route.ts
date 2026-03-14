import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrganization } from "@/lib/supabase/get-organization";

// GET — list assets for a client
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  const { data, error } = await supabase
    .from("client_assets")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — upload asset for a client
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrganization(supabase, user.id, user.email || undefined);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;
  const category = (formData.get("category") as string) || "other";

  if (!file || !clientId) {
    return NextResponse.json({ error: "Missing file or clientId" }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const adminDb = createAdminClient();
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${clientId}/${category}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await adminDb.storage
    .from("brand-assets")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
  }

  const { data: urlData } = adminDb.storage.from("brand-assets").getPublicUrl(storagePath);

  const { data: asset, error: insertError } = await adminDb
    .from("client_assets")
    .insert({
      client_id: clientId,
      organization_id: org.organizationId,
      name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      url: urlData.publicUrl,
      category,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(asset, { status: 201 });
}

// DELETE — remove an asset
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assetId = new URL(request.url).searchParams.get("id");
  if (!assetId) return NextResponse.json({ error: "Missing asset id" }, { status: 400 });

  const adminDb = createAdminClient();

  // Get asset to find storage path
  const { data: asset } = await adminDb
    .from("client_assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();

  if (asset) {
    await adminDb.storage.from("brand-assets").remove([asset.storage_path]);
  }

  const { error } = await adminDb.from("client_assets").delete().eq("id", assetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
