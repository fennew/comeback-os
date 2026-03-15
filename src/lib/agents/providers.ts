/**
 * Unified AI provider via OpenRouter — single API key for all models.
 * Uses OpenAI-compatible SDK with OpenRouter's endpoint.
 */

import OpenAI from "openai";

// ── Provider types ──────────────────────────────────────────
export type ProviderName = "anthropic" | "xai" | "openai" | "google" | "meta";

export interface ProviderConfig {
  provider: ProviderName;
  model: string;       // OpenRouter model ID (e.g. "anthropic/claude-sonnet-4")
  label: string;       // human-readable name
}

// All available models — using OpenRouter model IDs
export const AVAILABLE_MODELS: Record<string, ProviderConfig[]> = {
  anthropic: [
    { provider: "anthropic", model: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { provider: "anthropic", model: "anthropic/claude-opus-4", label: "Claude Opus 4" },
    { provider: "anthropic", model: "anthropic/claude-haiku-4", label: "Claude Haiku 4" },
    { provider: "anthropic", model: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  ],
  xai: [
    { provider: "xai", model: "x-ai/grok-3", label: "Grok 3" },
    { provider: "xai", model: "x-ai/grok-3-fast", label: "Grok 3 Fast" },
    { provider: "xai", model: "x-ai/grok-3-mini", label: "Grok 3 Mini" },
    { provider: "xai", model: "x-ai/grok-3-mini-fast", label: "Grok 3 Mini Fast" },
    { provider: "xai", model: "x-ai/grok-2-1212", label: "Grok 2" },
  ],
  openai: [
    { provider: "openai", model: "openai/gpt-4o", label: "GPT-4o" },
    { provider: "openai", model: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    { provider: "openai", model: "openai/gpt-4.1", label: "GPT-4.1" },
    { provider: "openai", model: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { provider: "openai", model: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { provider: "openai", model: "openai/o3-mini", label: "o3 Mini" },
  ],
  google: [
    { provider: "google", model: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro" },
    { provider: "google", model: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
    { provider: "google", model: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  ],
  meta: [
    { provider: "meta", model: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
    { provider: "meta", model: "meta-llama/llama-4-scout", label: "Llama 4 Scout" },
  ],
};

export function getAllModels(): ProviderConfig[] {
  return Object.values(AVAILABLE_MODELS).flat();
}

// Default model for new agents
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

// ── Tool schema conversion ──────────────────────────────────
interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function toolsToOpenAI(tools: ToolDef[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// ── Create OpenRouter client ────────────────────────────────
function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://comeback-os.vercel.app",
      "X-Title": "Comeback OS",
    },
  });
}

// ── Unified streaming (all models through OpenRouter) ───────
export async function* streamChat(opts: {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }>;
  tools: ToolDef[];
  maxTokens: number;
}): AsyncGenerator<{
  type: "text" | "tool_calls_done";
  text?: string;
  fullText?: string;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}> {
  const client = getClient();

  // Build OpenAI-format messages
  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.systemPrompt },
  ];

  for (const msg of opts.messages) {
    if (msg.role === "user") {
      openaiMessages.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        openaiMessages.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: (msg.tool_calls as Array<{ id: string; name: string; input: Record<string, unknown> }>).map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        });
      } else {
        openaiMessages.push({ role: "assistant", content: msg.content });
      }
    } else if (msg.role === "tool") {
      openaiMessages.push({
        role: "tool",
        tool_call_id: msg.tool_call_id || "",
        content: msg.content,
      });
    }
  }

  const openaiTools = opts.tools.length > 0 ? toolsToOpenAI(opts.tools) : undefined;

  const stream = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages: openaiMessages,
    tools: openaiTools,
    stream: true,
  });

  let fullText = "";
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      fullText += delta.content;
      yield { type: "text", text: delta.content };
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCallBuffers.has(idx)) {
          toolCallBuffers.set(idx, { id: tc.id || "", name: tc.function?.name || "", args: "" });
        }
        const buf = toolCallBuffers.get(idx)!;
        if (tc.id) buf.id = tc.id;
        if (tc.function?.name) buf.name = tc.function.name;
        if (tc.function?.arguments) buf.args += tc.function.arguments;
      }
    }
  }

  for (const buf of toolCallBuffers.values()) {
    let parsedInput = {};
    try {
      parsedInput = buf.args ? JSON.parse(buf.args) : {};
    } catch {
      // empty
    }
    toolCalls.push({ id: buf.id, name: buf.name, input: parsedInput });
  }

  yield { type: "tool_calls_done", fullText, toolCalls };
}
