export interface AgentConfig {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  category: "operations" | "creative" | "technical" | "business";
  icon: string;
  defaultModel: string;
  tools: string[];
  color: string;
}

export interface AgentContext {
  organizationId: string;
  clientId?: string | null;
  conversationId: string;
  userId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface StreamEvent {
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  content?: string;
  tool_call?: ToolCall;
  tool_result?: { tool_call_id: string; content: string };
  error?: string;
}
