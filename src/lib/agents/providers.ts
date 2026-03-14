/**
 * Multi-provider AI engine — supports Anthropic (Claude), xAI (Grok), and OpenAI (GPT)
 * All use streaming and tool calling.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { StreamEvent } from "./types";

// ── Provider types ──────────────────────────────────────────
export type ProviderName = "anthropic" | "xai" | "openai";

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  label: string; // human-readable name
}

// All available models per provider
export const AVAILABLE_MODELS: Record<ProviderName, ProviderConfig[]> = {
  anthropic: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { provider: "anthropic", model: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { provider: "anthropic", model: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
  ],
  xai: [
    { provider: "xai", model: "grok-3", label: "Grok 3" },
    { provider: "xai", model: "grok-3-fast", label: "Grok 3 Fast" },
    { provider: "xai", model: "grok-3-mini", label: "Grok 3 Mini" },
    { provider: "xai", model: "grok-3-mini-fast", label: "Grok 3 Mini Fast" },
    { provider: "xai", model: "grok-2", label: "Grok 2" },
  ],
  openai: [
    { provider: "openai", model: "gpt-4o", label: "GPT-4o" },
    { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o Mini" },
    { provider: "openai", model: "gpt-4.1", label: "GPT-4.1" },
    { provider: "openai", model: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { provider: "openai", model: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { provider: "openai", model: "o3-mini", label: "o3 Mini" },
  ],
};

export function getAllModels(): ProviderConfig[] {
  return Object.values(AVAILABLE_MODELS).flat();
}

// ── Parse model string to determine provider ────────────────
export function resolveProvider(modelString: string): { provider: ProviderName; model: string } {
  // Check if it starts with a provider prefix like "xai:", "anthropic:", or "openai:"
  if (modelString.startsWith("xai:")) {
    return { provider: "xai", model: modelString.slice(4) };
  }
  if (modelString.startsWith("anthropic:")) {
    return { provider: "anthropic", model: modelString.slice(10) };
  }
  if (modelString.startsWith("openai:")) {
    return { provider: "openai", model: modelString.slice(7) };
  }

  // Check if the model name matches a known xAI model
  if (modelString.startsWith("grok")) {
    return { provider: "xai", model: modelString };
  }

  // Check if the model name matches a known OpenAI model
  if (modelString.startsWith("gpt-") || modelString.startsWith("o3") || modelString.startsWith("o4")) {
    return { provider: "openai", model: modelString };
  }

  // Default to Anthropic
  return { provider: "anthropic", model: modelString };
}

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

// ── Anthropic streaming (existing logic extracted) ──────────
export async function* streamAnthropic(opts: {
  model: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools: ToolDef[];
  maxTokens: number;
}): AsyncGenerator<{
  type: "text" | "tool_calls_done";
  text?: string;
  fullText?: string;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const toolsParam: Anthropic.Tool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  const stream = anthropic.messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.systemPrompt,
    messages: opts.messages,
    tools: toolsParam.length > 0 ? toolsParam : undefined,
  });

  let fullText = "";
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  let currentToolInput = "";
  let currentToolName = "";
  let currentToolId = "";

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "tool_use") {
        currentToolId = event.content_block.id;
        currentToolName = event.content_block.name;
        currentToolInput = "";
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        fullText += event.delta.text;
        yield { type: "text", text: event.delta.text };
      } else if (event.delta.type === "input_json_delta") {
        currentToolInput += event.delta.partial_json;
      }
    } else if (event.type === "content_block_stop") {
      if (currentToolName) {
        let parsedInput = {};
        try {
          parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {};
        } catch {
          // empty
        }
        toolCalls.push({ id: currentToolId, name: currentToolName, input: parsedInput });
        currentToolName = "";
        currentToolId = "";
        currentToolInput = "";
      }
    }
  }

  yield { type: "tool_calls_done", fullText, toolCalls };
}

// ── OpenAI (GPT) streaming ───────────────────────────────────
export async function* streamOpenAI(opts: {
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY in your environment variables.");
  }
  const client = new OpenAI({ apiKey });

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

// ── xAI / OpenAI-compatible streaming ───────────────────────
export async function* streamXAI(opts: {
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
  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing xAI API key. Set XAI_API_KEY in your environment variables.");
  }
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });

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

    // Text content
    if (delta.content) {
      fullText += delta.content;
      yield { type: "text", text: delta.content };
    }

    // Tool calls
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

  // Parse all accumulated tool calls
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
