import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Configure VAPID
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:hello@comeback-os.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createAdminClient();

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  // Clean up expired subscriptions (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected" && (result.reason as { statusCode?: number })?.statusCode === 410) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscriptions[i].endpoint);
    }
  }
}

export async function sendPushToOrganization(organizationId: string, payload: PushPayload) {
  const supabase = createAdminClient();

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);

  if (!members) return;

  await Promise.allSettled(
    members.map((m) => sendPushToUser(m.user_id, payload))
  );
}
