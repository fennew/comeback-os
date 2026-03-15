/**
 * Direct task/handoff executors — run inline without Inngest.
 * Called fire-and-forget from agent tools so work happens immediately.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { executeAgent } from "./engine";

// ============================================================
// HANDOFF EXECUTOR
// ============================================================

interface HandoffParams {
  handoffId: string;
  organizationId: string;
  clientId: string | null;
  toAgentSlug: string;
  context: string;
  instructions: string | null;
}

export async function processHandoffDirect(params: HandoffParams) {
  const { handoffId, organizationId, clientId, toAgentSlug, context, instructions } = params;
  const supabase = createAdminClient();

  try {
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

    // Create in-app notification
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
          link: `/operations/results`,
        });
      }
    }

    console.log(`[Handoff ${handoffId}] Completed by ${toAgentSlug}`);
  } catch (err) {
    console.error(`[Handoff ${handoffId}] Failed:`, err);
    await supabase
      .from("agent_handoffs")
      .update({ status: "failed", result: String(err) })
      .eq("id", handoffId);
  }
}

// ============================================================
// TASK EXECUTOR
// ============================================================

interface TaskParams {
  taskId: string;
  organizationId: string;
  clientId: string | null;
  agentSlug: string;
}

export async function executeTaskDirect(params: TaskParams) {
  const { taskId, organizationId, clientId, agentSlug } = params;
  const supabase = createAdminClient();

  try {
    // Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (!task) {
      console.error(`[Task ${taskId}] Not found`);
      return;
    }

    // Mark task as in_progress
    await supabase
      .from("tasks")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", taskId);

    // Create a conversation for the task
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        organization_id: organizationId,
        client_id: clientId || null,
        agent_slug: agentSlug,
        title: `Task: ${task.title}`,
        metadata: { task_id: taskId },
      })
      .select("id")
      .single();

    if (!conv) {
      await supabase
        .from("tasks")
        .update({ status: "pending", result: "Failed to start" })
        .eq("id", taskId);
      return;
    }

    // Execute the agent with the task
    const taskMessage = `[TASK ASSIGNED]
Title: ${task.title}
Description: ${task.description || "No additional description"}
Priority: ${task.priority}

Please complete this task and provide the result.`;

    let result = "";
    const startTime = Date.now();

    const agentStream = executeAgent({
      agentSlug,
      context: {
        organizationId,
        clientId: clientId || null,
        conversationId: conv.id,
        userId: "system",
      },
      userMessage: taskMessage,
    });

    for await (const event of agentStream) {
      if (event.type === "text" && event.content) {
        result += event.content;
      }
    }

    const durationMs = Date.now() - startTime;

    // Mark task as review (for user to approve)
    await supabase
      .from("tasks")
      .update({
        status: "review",
        result: result.slice(0, 10000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    // Log time entry
    await supabase.from("time_entries").insert({
      organization_id: organizationId,
      client_id: clientId || null,
      agent_slug: agentSlug,
      task_id: taskId,
      description: task.title,
      duration_ms: durationMs,
    });

    // Notify user
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId);

    if (members) {
      for (const member of members) {
        await supabase.from("notifications").insert({
          organization_id: organizationId,
          user_id: member.user_id,
          type: "task_review",
          title: `Task ready for review: ${task.title}`,
          body: `${agentSlug.replace(/-/g, " ")} completed the task.`,
          link: "/tasks",
        });
      }
    }

    console.log(`[Task ${taskId}] Completed by ${agentSlug} in ${durationMs}ms`);
  } catch (err) {
    console.error(`[Task ${taskId}] Failed:`, err);
    await supabase
      .from("tasks")
      .update({
        status: "pending",
        result: `Execution failed: ${String(err)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}
