import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeAgent } from "@/lib/agents/engine";

export const processHandoff = inngest.createFunction(
  { id: "process-agent-handoff", name: "Process Agent Handoff" },
  { event: "agent/handoff.created" },
  async ({ event }) => {
    const { handoffId, organizationId, clientId, toAgentSlug, context, instructions } = event.data;

    const supabase = createAdminClient();

    // Mark handoff as processing
    await supabase
      .from("agent_handoffs")
      .update({ status: "processing" })
      .eq("id", handoffId);

    // Create a conversation for the handoff
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        organization_id: organizationId,
        client_id: clientId || null,
        agent_slug: toAgentSlug,
        title: `Handoff: ${context.slice(0, 80)}`,
        metadata: { handoff_id: handoffId },
      })
      .select("id")
      .single();

    if (!conv) {
      await supabase
        .from("agent_handoffs")
        .update({ status: "failed", result: "Failed to create conversation" })
        .eq("id", handoffId);
      return;
    }

    // Build the handoff message
    const handoffMessage = `[HANDOFF RECEIVED]
Context: ${context}
${instructions ? `\nInstructions: ${instructions}` : ""}

Please process this handoff and complete the requested work.`;

    // Execute the agent
    let result = "";
    const agentStream = executeAgent({
      agentSlug: toAgentSlug,
      context: {
        organizationId,
        clientId: clientId || null,
        conversationId: conv.id,
        userId: "system",
      },
      userMessage: handoffMessage,
    });

    for await (const event of agentStream) {
      if (event.type === "text" && event.content) {
        result += event.content;
      }
    }

    // Mark handoff as completed
    await supabase
      .from("agent_handoffs")
      .update({
        status: "completed",
        result: result.slice(0, 5000),
        completed_at: new Date().toISOString(),
      })
      .eq("id", handoffId);

    // Create notification
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId);

    if (members) {
      for (const member of members) {
        await supabase.from("notifications").insert({
          organization_id: organizationId,
          user_id: member.user_id,
          type: "handoff_complete",
          title: `Handoff completed by ${toAgentSlug.replace(/-/g, " ")}`,
          body: result.slice(0, 200),
          link: `/agents/${toAgentSlug}`,
        });
      }
    }

    return { success: true, handoffId };
  }
);
