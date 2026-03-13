import { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeAgent } from "@/lib/agents/engine";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { agentSlug, message, clientId, conversationId } = body;

  if (!agentSlug || !message) {
    return new Response("Missing agentSlug or message", { status: 400 });
  }

  // Get user's organization
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return new Response("No organization found", { status: 403 });
  }

  const organizationId = membership.organization_id;
  const adminDb = createAdminClient();

  // Get or create conversation
  let activeConversationId = conversationId;

  if (!activeConversationId) {
    const { data: conv, error } = await adminDb
      .from("conversations")
      .insert({
        organization_id: organizationId,
        client_id: clientId || null,
        agent_slug: agentSlug,
        title: message.slice(0, 100),
      })
      .select("id")
      .single();

    if (error) {
      return new Response(`Failed to create conversation: ${error.message}`, {
        status: 500,
      });
    }
    activeConversationId = conv.id;
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send conversation ID first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "conversation_id", id: activeConversationId })}\n\n`
          )
        );

        const agentStream = executeAgent({
          agentSlug,
          context: {
            organizationId,
            clientId: clientId || null,
            conversationId: activeConversationId,
            userId: user.id,
          },
          userMessage: message,
        });

        for await (const event of agentStream) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
