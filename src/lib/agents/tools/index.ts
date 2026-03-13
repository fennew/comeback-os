import type { ToolDefinition, ToolResult, AgentContext } from "../types";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// TOOL DEFINITIONS
// ============================================================

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_client_info: {
    name: "get_client_info",
    description:
      "Get information about the current client including brand data, industry, website, and brand voice.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  list_clients: {
    name: "list_clients",
    description: "List all clients in the agency.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  create_task: {
    name: "create_task",
    description:
      "Create a new task and assign it to a specific agent. Use this when work needs to be done by you or another agent.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title" },
        description: {
          type: "string",
          description: "Detailed task description",
        },
        agent_slug: {
          type: "string",
          description:
            "Agent to assign the task to (e.g., 'copywriter', 'email-designer')",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Task priority level",
        },
      },
      required: ["title", "agent_slug"],
    },
  },

  update_task: {
    name: "update_task",
    description: "Update the status or result of an existing task.",
    input_schema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "The task ID to update" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "review", "completed", "cancelled"],
        },
        result: {
          type: "string",
          description: "The result or output of the task",
        },
      },
      required: ["task_id"],
    },
  },

  list_tasks: {
    name: "list_tasks",
    description:
      "List tasks, optionally filtered by status or agent.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["pending", "in_progress", "review", "completed", "cancelled"],
          description: "Filter by status",
        },
        agent_slug: {
          type: "string",
          description: "Filter by assigned agent",
        },
      },
      required: [],
    },
  },

  send_handoff: {
    name: "send_handoff",
    description:
      "Hand off work to another agent. The target agent will receive your context and instructions, and will process the work asynchronously.",
    input_schema: {
      type: "object" as const,
      properties: {
        to_agent: {
          type: "string",
          description:
            "The slug of the agent to hand off to (e.g., 'email-designer', 'copywriter')",
        },
        context: {
          type: "string",
          description: "Context about the work being handed off",
        },
        instructions: {
          type: "string",
          description: "Specific instructions for the target agent",
        },
      },
      required: ["to_agent", "context"],
    },
  },

  search_conversations: {
    name: "search_conversations",
    description:
      "Search through past conversation history with agents for a specific client.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        agent_slug: {
          type: "string",
          description: "Filter by specific agent",
        },
      },
      required: ["query"],
    },
  },
};

// ============================================================
// TOOL EXECUTORS
// ============================================================

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const supabase = createAdminClient();

  switch (toolName) {
    case "get_client_info": {
      if (!context.clientId) {
        return {
          success: false,
          error: "No client is currently selected. Ask the user to select a client first.",
        };
      }
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", context.clientId)
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    case "list_clients": {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, industry, status, monthly_retainer")
        .eq("organization_id", context.organizationId)
        .order("name");

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    case "create_task": {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          organization_id: context.organizationId,
          client_id: context.clientId || null,
          agent_slug: input.agent_slug as string,
          title: input.title as string,
          description: (input.description as string) || null,
          priority: (input.priority as string) || "medium",
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    case "update_task": {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.status) {
        updates.status = input.status;
        if (input.status === "in_progress") updates.started_at = new Date().toISOString();
        if (input.status === "completed") updates.completed_at = new Date().toISOString();
      }
      if (input.result) updates.result = input.result;

      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", input.task_id as string)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    case "list_tasks": {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (input.status) query = query.eq("status", input.status as string);
      if (input.agent_slug) query = query.eq("agent_slug", input.agent_slug as string);
      if (context.clientId) query = query.eq("client_id", context.clientId);

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    case "send_handoff": {
      const { data, error } = await supabase
        .from("agent_handoffs")
        .insert({
          organization_id: context.organizationId,
          client_id: context.clientId || null,
          from_agent_slug: "current", // will be overridden by engine
          to_agent_slug: input.to_agent as string,
          context: input.context as string,
          instructions: (input.instructions as string) || null,
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      // TODO: Trigger Inngest event for async processing
      return {
        success: true,
        data: {
          handoff_id: data.id,
          message: `Work handed off to ${input.to_agent}. They will process it and you'll be notified when complete.`,
        },
      };
    }

    case "search_conversations": {
      let query = supabase
        .from("messages")
        .select("id, role, content, created_at, conversation_id")
        .ilike("content", `%${input.query}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

export function getToolDefinitions(toolNames: string[]): ToolDefinition[] {
  return toolNames
    .map((name) => TOOL_DEFINITIONS[name])
    .filter(Boolean);
}
