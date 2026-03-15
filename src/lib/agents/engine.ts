import { createAdminClient } from "@/lib/supabase/admin";
import { getAgent } from "./registry";
import { getToolDefinitions, executeTool } from "./tools";
import { getAgentPrompt } from "./prompts";
import { streamChat, DEFAULT_MODEL } from "./providers";
import type { AgentContext, StreamEvent } from "./types";

interface EngineOptions {
  agentSlug: string;
  context: AgentContext;
  userMessage: string;
  systemPromptOverride?: string;
  modelOverride?: string;
}

export async function* executeAgent(
  options: EngineOptions
): AsyncGenerator<StreamEvent> {
  const { agentSlug, context, userMessage, systemPromptOverride } = options;

  const agent = getAgent(agentSlug);
  if (!agent) {
    yield { type: "error", error: `Agent "${agentSlug}" not found` };
    return;
  }

  const supabase = createAdminClient();

  // Load agent config from DB (custom prompts/settings override defaults)
  const { data: agentConfig } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("slug", agentSlug)
    .single();

  // Build system prompt
  let systemPrompt = systemPromptOverride || agentConfig?.system_prompt || getAgentPrompt(agentSlug);

  // Add client context if available
  if (context.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", context.clientId)
      .single();

    if (client) {
      systemPrompt += `\n\n## Current Client Context
- Name: ${client.name}
- Industry: ${client.industry || "Not specified"}
- Website: ${client.website || "Not specified"}
- Brand Voice: ${client.brand_voice || "Not specified"}
- Brand Colors: ${client.brand_colors || "Not specified"}
- Monthly Retainer: ${client.monthly_retainer ? `$${client.monthly_retainer}` : "Not specified"}
- Contract Period: ${client.contract_start || "N/A"} to ${client.contract_end || "N/A"}
- Status: ${client.status || "active"}
- Notes: ${client.notes || "None"}`;

      // Load brand assets for this client
      const { data: assets } = await supabase
        .from("client_assets")
        .select("name, file_type, url, category")
        .eq("client_id", context.clientId)
        .order("category");

      if (assets && assets.length > 0) {
        const assetsByCategory: Record<string, Array<{ name: string; url: string; file_type: string }>> = {};
        for (const a of assets) {
          if (!assetsByCategory[a.category]) assetsByCategory[a.category] = [];
          assetsByCategory[a.category].push(a);
        }

        systemPrompt += `\n\n## Client Brand Assets`;
        for (const [category, items] of Object.entries(assetsByCategory)) {
          systemPrompt += `\n### ${category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, " ")}`;
          for (const item of items) {
            systemPrompt += `\n- ${item.name} (${item.file_type}): ${item.url}`;
          }
        }
        systemPrompt += `\n\nUse these brand assets as reference when creating content for this client.`;
      }
    }
  }

  // Load conversation history
  const { data: existingMessages } = await supabase
    .from("messages")
    .select("role, content, tool_calls, tool_call_id")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: true })
    .limit(50);

  // Resolve model: per-chat override > DB config > registry default
  const model = options.modelOverride || agentConfig?.model || agent.defaultModel;
  const maxTokens = agentConfig?.max_tokens || 4096;

  // Get tool definitions
  const tools = getToolDefinitions(agent.tools);

  // Save user message to DB
  await supabase.from("messages").insert({
    conversation_id: context.conversationId,
    role: "user",
    content: userMessage,
  });

  // Build messages array
  const messages: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }> = [];

  for (const msg of (existingMessages || [])) {
    if (msg.role === "user") {
      messages.push({ role: "user", content: msg.content || "" });
    } else if (msg.role === "assistant") {
      messages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls ? (msg.tool_calls as unknown[]) : undefined,
      });
    } else if (msg.role === "tool") {
      messages.push({
        role: "tool",
        content: msg.content || "",
        tool_call_id: msg.tool_call_id || undefined,
      });
    }
  }

  messages.push({ role: "user", content: userMessage });

  // Stream loop with tool calling
  let continueLoop = true;
  while (continueLoop) {
    continueLoop = false;

    let fullText = "";
    let toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for await (const event of streamChat({
      model,
      systemPrompt,
      messages,
      tools,
      maxTokens,
    })) {
      if (event.type === "text" && event.text) {
        yield { type: "text", content: event.text };
      }
      if (event.type === "tool_calls_done") {
        fullText = event.fullText || "";
        toolCalls = event.toolCalls || [];
      }
    }

    // Save assistant message
    await supabase.from("messages").insert({
      conversation_id: context.conversationId,
      role: "assistant",
      content: fullText || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : null,
    });

    // Tool call handling
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        yield { type: "tool_use", tool_call: { id: tc.id, name: tc.name, input: tc.input } };
      }

      messages.push({
        role: "assistant",
        content: fullText || "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        if (tc.name === "send_handoff") tc.input.from_agent = agentSlug;
        const result = await executeTool(tc.name, tc.input, context);
        const resultStr = JSON.stringify(result);
        await supabase.from("messages").insert({
          conversation_id: context.conversationId,
          role: "tool",
          content: resultStr,
          tool_call_id: tc.id,
        });
        yield { type: "tool_result", tool_result: { tool_call_id: tc.id, content: resultStr } };
        messages.push({ role: "tool", content: resultStr, tool_call_id: tc.id });
      }

      continueLoop = true;
    }
  }

  yield { type: "done" };
}
