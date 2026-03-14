import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgent } from "./registry";
import { getToolDefinitions, executeTool } from "./tools";
import { getAgentPrompt } from "./prompts";
import { resolveProvider, streamAnthropic, streamXAI } from "./providers";
import type { AgentContext, StreamEvent } from "./types";

interface EngineOptions {
  agentSlug: string;
  context: AgentContext;
  userMessage: string;
  systemPromptOverride?: string;
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
- Notes: ${client.notes || "None"}`;
    }
  }

  // Load conversation history
  const { data: existingMessages } = await supabase
    .from("messages")
    .select("role, content, tool_calls, tool_call_id")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: true })
    .limit(50);

  // Resolve which provider + model to use
  const modelString = agentConfig?.model || agent.defaultModel;
  const { provider, model } = resolveProvider(modelString);
  const maxTokens = agentConfig?.max_tokens || 4096;

  // Get tool definitions
  const tools = getToolDefinitions(agent.tools);

  // Add new user message
  // Save user message to DB
  await supabase.from("messages").insert({
    conversation_id: context.conversationId,
    role: "user",
    content: userMessage,
  });

  // ── Anthropic path ────────────────────────────────────
  if (provider === "anthropic") {
    yield* runAnthropic({
      model,
      maxTokens,
      systemPrompt,
      existingMessages: existingMessages || [],
      userMessage,
      tools,
      agentSlug,
      context,
      supabase,
    });
  }
  // ── xAI (Grok) path ──────────────────────────────────
  else if (provider === "xai") {
    yield* runXAI({
      model,
      maxTokens,
      systemPrompt,
      existingMessages: existingMessages || [],
      userMessage,
      tools,
      agentSlug,
      context,
      supabase,
    });
  } else {
    yield { type: "error", error: `Unknown provider: ${provider}` };
    return;
  }

  yield { type: "done" };
}

// ── Anthropic runner ────────────────────────────────────────
async function* runAnthropic(opts: {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  existingMessages: Array<{ role: string; content: string | null; tool_calls: unknown; tool_call_id: string | null }>;
  userMessage: string;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  agentSlug: string;
  context: AgentContext;
  supabase: ReturnType<typeof createAdminClient>;
}): AsyncGenerator<StreamEvent> {
  // Build Anthropic messages array
  const messages: Anthropic.MessageParam[] = [];

  for (const msg of opts.existingMessages) {
    if (msg.role === "user") {
      messages.push({ role: "user", content: msg.content || "" });
    } else if (msg.role === "assistant") {
      if (msg.tool_calls) {
        const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        const tcs = msg.tool_calls as Array<{ id: string; name: string; input: Record<string, unknown> }>;
        for (const tc of tcs) {
          content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
        }
        messages.push({ role: "assistant", content });
      } else {
        messages.push({ role: "assistant", content: msg.content || "" });
      }
    } else if (msg.role === "tool") {
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: msg.tool_call_id || "", content: msg.content || "" }],
      });
    }
  }

  messages.push({ role: "user", content: opts.userMessage });

  let continueLoop = true;
  while (continueLoop) {
    continueLoop = false;

    let fullText = "";
    let toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for await (const event of streamAnthropic({
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      messages,
      tools: opts.tools,
      maxTokens: opts.maxTokens,
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
    await opts.supabase.from("messages").insert({
      conversation_id: opts.context.conversationId,
      role: "assistant",
      content: fullText || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : null,
    });

    // Tool call handling
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        yield { type: "tool_use", tool_call: { id: tc.id, name: tc.name, input: tc.input } };
      }

      const assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
      if (fullText) assistantContent.push({ type: "text", text: fullText });
      for (const tc of toolCalls) {
        assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tc of toolCalls) {
        if (tc.name === "send_handoff") tc.input.from_agent = opts.agentSlug;
        const result = await executeTool(tc.name, tc.input, opts.context);
        const resultStr = JSON.stringify(result);
        await opts.supabase.from("messages").insert({
          conversation_id: opts.context.conversationId,
          role: "tool",
          content: resultStr,
          tool_call_id: tc.id,
        });
        yield { type: "tool_result", tool_result: { tool_call_id: tc.id, content: resultStr } };
        toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: resultStr });
      }

      messages.push({ role: "user", content: toolResults });
      continueLoop = true;
    }
  }
}

// ── xAI (Grok) runner ───────────────────────────────────────
async function* runXAI(opts: {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  existingMessages: Array<{ role: string; content: string | null; tool_calls: unknown; tool_call_id: string | null }>;
  userMessage: string;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  agentSlug: string;
  context: AgentContext;
  supabase: ReturnType<typeof createAdminClient>;
}): AsyncGenerator<StreamEvent> {
  // Build OpenAI-compatible messages
  const messages: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }> = [];

  for (const msg of opts.existingMessages) {
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

  messages.push({ role: "user", content: opts.userMessage });

  let continueLoop = true;
  while (continueLoop) {
    continueLoop = false;

    let fullText = "";
    let toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for await (const event of streamXAI({
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      messages,
      tools: opts.tools,
      maxTokens: opts.maxTokens,
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
    await opts.supabase.from("messages").insert({
      conversation_id: opts.context.conversationId,
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
        if (tc.name === "send_handoff") tc.input.from_agent = opts.agentSlug;
        const result = await executeTool(tc.name, tc.input, opts.context);
        const resultStr = JSON.stringify(result);
        await opts.supabase.from("messages").insert({
          conversation_id: opts.context.conversationId,
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
}
