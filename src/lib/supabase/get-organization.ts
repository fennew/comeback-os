import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";

/**
 * Get the user's organization, auto-creating one if none exists.
 * Uses admin client for creation to bypass RLS policies.
 */
export async function getOrCreateOrganization(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string
): Promise<{ organizationId: string } | null> {
  // Check for existing membership (uses user's client — RLS allows reading own memberships)
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (membership) {
    return { organizationId: membership.organization_id };
  }

  // No membership found — use admin client to bypass RLS for creation
  const adminDb = createAdminClient();

  const orgName = userEmail
    ? `${userEmail.split("@")[0]}'s Agency`
    : "My Agency";

  const { data: org, error: orgError } = await adminDb
    .from("organizations")
    .insert({ name: orgName, owner_id: userId })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("Failed to auto-create organization:", orgError);
    return null;
  }

  // Create membership
  const { error: memberError } = await adminDb
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: userId,
      role: "owner",
    });

  if (memberError) {
    console.error("Failed to create organization membership:", memberError);
    return null;
  }

  // Create profile if it doesn't exist
  const { data: existingProfile } = await adminDb
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    await adminDb.from("profiles").insert({
      id: userId,
      email: userEmail || "",
      full_name: userEmail ? userEmail.split("@")[0] : "User",
    });
  }

  return { organizationId: org.id };
}
