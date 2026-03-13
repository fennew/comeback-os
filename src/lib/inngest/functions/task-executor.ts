import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeAgent } from "@/lib/agents/engine";

export const executeTask = inngest.createFunction(
  { id: "execute-agent-task", name: "Execute Agent Task" },
  { event: "agent/task.execute" },
  async ({ event }) => {
    const { taskId, organizationId, clientId, agentSlug } = event.data;

    const supabase = createAdminClient();

    // Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (!task) return { error: "Task not found" };

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
      return { error: "Failed to create conversation" };
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

    return { success: true, taskId, durationMs };
  }
);
