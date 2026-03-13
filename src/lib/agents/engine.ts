import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgent } from "./registry";
import { getToolDefinitions, executeTool } from "./tools";
import { getAgentPrompt } from "./prompts";
import type { AgentContext, StreamEvent } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

  // Build messages array for Claude
  const messages: Anthropic.MessageParam[] = [];

  if (existingMessages) {
    for (const msg of existingMessages) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content || "" });
      } else if (msg.role === "assistant") {
        if (msg.tool_calls) {
          const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
          if (msg.content) {
            content.push({ type: "text", text: msg.content });
          }
          const toolCalls = msg.tool_calls as Array<{ id: string; name: string; input: Record<string, unknown> }>;
          for (const tc of toolCalls) {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.input,
            });
          }
          messages.push({ role: "assistant", content });
        } else {
          messages.push({ role: "assistant", content: msg.content || "" });
        }
      } else if (msg.role === "tool") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.tool_call_id || "",
              content: msg.content || "",
            },
          ],
        });
      }
    }
  }

  // Add new user message
  messages.push({ role: "user", content: userMessage });

  // Save user message to DB
  await supabase.from("messages").insert({
    conversation_id: context.conversationId,
    role: "user",
    content: userMessage,
  });

  // Get tool definitions
  const tools = getToolDefinitions(agent.tools);
  const toolsParam: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  // Model config
  const model = agentConfig?.model || agent.defaultModel;
  const maxTokens = agentConfig?.max_tokens || 4096;

  // Run agent loop (handles tool use automatically)
  let continueLoop = true;

  while (continueLoop) {
    continueLoop = false;

    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      tools: toolsParam.length > 0 ? toolsParam : undefined,
    });

    let fullText = "";
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let currentToolInput = "";
    let currentToolName = "";
    let currentToolId = "";

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          // text block starting
        } else if (event.content_block.type === "tool_use") {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolInput = "";
          yield {
            type: "tool_use",
            tool_call: {
              id: currentToolId,
              name: currentToolName,
              input: {},
            },
          };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          fullText += event.delta.text;
          yield { type: "text", content: event.delta.text };
        } else if (event.delta.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolName) {
          let parsedInput = {};
          try {
            parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {};
          } catch {
            // empty input
          }
          toolCalls.push({
            id: currentToolId,
            name: currentToolName,
            input: parsedInput,
          });
          currentToolName = "";
          currentToolId = "";
          currentToolInput = "";
        }
      }
    }

    // Save assistant message
    await supabase.from("messages").insert({
      conversation_id: context.conversationId,
      role: "assistant",
      content: fullText || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : null,
    });

    // If there were tool calls, execute them and continue the loop
    if (toolCalls.length > 0) {
      // Build assistant content for next turn
      const assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
      if (fullText) {
        assistantContent.push({ type: "text", text: fullText });
      }
      for (const tc of toolCalls) {
        assistantContent.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      messages.push({ role: "assistant", content: assistantContent });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tc of toolCalls) {
        // Override from_agent_slug for handoffs
        if (tc.name === "send_handoff") {
          tc.input.from_agent = agentSlug;
        }

        const result = await executeTool(tc.name, tc.input, context);
        const resultStr = JSON.stringify(result);

        // Save tool result message
        await supabase.from("messages").insert({
          conversation_id: context.conversationId,
          role: "tool",
          content: resultStr,
          tool_call_id: tc.id,
        });

        yield {
          type: "tool_result",
          tool_result: { tool_call_id: tc.id, content: resultStr },
        };

        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: resultStr,
        });
      }

      messages.push({ role: "user", content: toolResults });

      // Reset for next iteration
      fullText = "";
      continueLoop = true;
    }
  }

  yield { type: "done" };
}
