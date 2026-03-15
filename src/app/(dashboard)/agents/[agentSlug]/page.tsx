"use client";

import { useParams } from "next/navigation";
import { getAgent } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ListTodo, Wrench, Bot, Paperclip, X, FileText, Image as ImageIcon, Settings2, Save, Loader2, Plus } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useClientContext } from "@/providers/client-context-provider";
import { AVAILABLE_MODELS } from "@/lib/agents/providers";
import { getAgentPrompt } from "@/lib/agents/prompts";

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  url: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: UploadedFile[];
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  toolResults?: Array<{ tool_call_id: string; content: string }>;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  agent_slug: string;
  client_id: string | null;
  preview: string;
  created_at: string;
  updated_at: string;
}

export default function AgentPage() {
  const params = useParams();
  const slug = params.agentSlug as string;
  const agent = getAgent(slug);
  const { activeClient } = useClientContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(agent?.defaultModel || "google/gemini-2.5-flash-preview");
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Load messages for a specific conversation
  const loadMessages = useCallback(async (convId: string) => {
    setConversationId(convId);
    try {
      const res = await fetch(`/api/agents/conversations/${convId}/messages`);
      if (!res.ok) return;
      const data = await res.json();

      // Transform DB messages to UI format (skip tool role messages)
      const uiMessages: Message[] = [];
      for (const msg of data) {
        if (msg.role === "tool") continue;
        if (msg.role === "user" || msg.role === "assistant") {
          uiMessages.push({
            id: msg.id,
            role: msg.role,
            content: msg.content || "",
            toolCalls: msg.tool_calls || undefined,
            timestamp: new Date(msg.created_at),
          });
        }
      }
      setMessages(uiMessages);
      setStreamingContent("");
    } catch {
      // ignore
    }
  }, []);

  // Load conversations list when agent or client changes
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    // Reset state when switching agents
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");

    async function loadConversations() {
      try {
        const qp = new URLSearchParams({ agent_slug: slug });
        if (activeClient?.id) qp.set("client_id", activeClient.id);
        const res = await fetch(`/api/agents/conversations?${qp}`);
        if (!res.ok || cancelled) return;
        const data: Conversation[] = await res.json();
        if (cancelled) return;
        setConversations(data);

        // Auto-select most recent conversation and load its messages
        if (data.length > 0) {
          await loadMessages(data[0].id);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadConversations();
    return () => { cancelled = true; };
  }, [slug, activeClient?.id, loadMessages]);

  function startNewConversation() {
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");
    setInput("");
  }

  // Load custom instructions when panel opens
  useEffect(() => {
    if (showInstructions && slug) {
      setInstructions(getAgentPrompt(slug));
      fetch("/api/settings/agents")
        .then((r) => r.json())
        .then((configs: Array<{ slug: string; model: string; system_prompt?: string }>) => {
          const config = configs.find((c: { slug: string }) => c.slug === slug);
          if (config?.system_prompt) {
            setInstructions(config.system_prompt);
          }
        })
        .catch(() => {});
    }
  }, [showInstructions, slug]);

  async function saveInstructions() {
    setSavingInstructions(true);
    try {
      await fetch("/api/settings/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, model: selectedModel, system_prompt: instructions }),
      });
      setInstructionsSaved(true);
      setTimeout(() => setInstructionsSaved(false), 2000);
    } finally {
      setSavingInstructions(false);
    }
  }

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          console.error("Upload failed:", err.error);
          continue;
        }
        const uploaded = await res.json();
        setAttachedFiles((prev) => [...prev, uploaded]);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function getFileIcon(type: string) {
    if (type.startsWith("image/")) return ImageIcon;
    return FileText;
  }

  async function handleSend() {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    let messageContent = input.trim();
    const currentFiles = [...attachedFiles];

    if (currentFiles.length > 0) {
      const fileList = currentFiles
        .map((f) => `[Attached file: ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB) - ${f.url}]`)
        .join("\n");
      messageContent = messageContent ? `${messageContent}\n\n${fileList}` : fileList;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim() || "Uploaded file(s)",
      files: currentFiles.length > 0 ? currentFiles : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = messageContent;
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentSlug: slug,
          message: messageText,
          clientId: activeClient?.id || null,
          conversationId,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulatedText = "";
      const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      const toolResults: Array<{ tool_call_id: string; content: string }> = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case "conversation_id":
                setConversationId(event.id);
                // Add to conversations list if new
                setConversations((prev) => {
                  if (prev.find((c) => c.id === event.id)) return prev;
                  return [{
                    id: event.id,
                    title: messageText.slice(0, 100),
                    agent_slug: slug,
                    client_id: activeClient?.id || null,
                    preview: messageText.slice(0, 100),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }, ...prev];
                });
                break;

              case "text":
                accumulatedText += event.content;
                setStreamingContent(accumulatedText);
                break;

              case "tool_use":
                toolCalls.push(event.tool_call);
                break;

              case "tool_result":
                toolResults.push(event.tool_result);
                if (accumulatedText) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: accumulatedText,
                      toolCalls: [...toolCalls],
                      toolResults: [...toolResults],
                      timestamp: new Date(),
                    },
                  ]);
                  accumulatedText = "";
                  setStreamingContent("");
                }
                break;

              case "done":
                if (accumulatedText) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: accumulatedText,
                      toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                      timestamp: new Date(),
                    },
                  ]);
                }
                setStreamingContent("");
                break;

              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: `Error: ${event.error}`,
                    timestamp: new Date(),
                  },
                ]);
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${errorMessage}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Agent header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", agent.color)}>
            <agent.icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeClient && (
            <Badge variant="outline">{activeClient.name}</Badge>
          )}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {Object.entries(AVAILABLE_MODELS).map(([key, models]) => (
              <optgroup key={key} label={key === "xai" ? "xAI (Grok)" : key === "openai" ? "OpenAI (GPT)" : key === "anthropic" ? "Anthropic (Claude)" : key === "google" ? "Google (Gemini)" : key === "meta" ? "Meta (Llama)" : key}>
                {models.map((m) => (
                  <option key={m.model} value={m.model}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button
            variant={showInstructions ? "default" : "outline"}
            size="sm"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Instructions
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agents/${slug}/tasks`}>
              <ListTodo className="mr-2 h-4 w-4" />
              Tasks
            </Link>
          </Button>
        </div>
      </div>

      {/* Instructions panel */}
      {showInstructions && (
        <div className="border-b border-border py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Agent Instructions</h3>
              <p className="text-xs text-muted-foreground">Edit the system prompt that defines how this agent behaves</p>
            </div>
            <div className="flex items-center gap-2">
              {instructionsSaved && <span className="text-xs text-green-500">Saved!</span>}
              <Button size="sm" onClick={saveInstructions} disabled={savingInstructions}>
                {savingInstructions ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setInstructions(getAgentPrompt(slug)); }}>
                Reset to default
              </Button>
            </div>
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono min-h-[200px] max-h-[400px] resize-y"
            placeholder="System prompt for this agent..."
          />
        </div>
      )}

      {/* Main chat area with conversation sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list sidebar */}
        <div className="w-56 shrink-0 border-r border-border flex flex-col">
          <div className="p-2 border-b border-border">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={startNewConversation}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="p-3 text-xs text-muted-foreground">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No conversations yet</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors",
                    conversationId === conv.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate flex-1">{conv.title}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{formatDate(conv.updated_at)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{conv.preview}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-4 px-4" ref={scrollRef}>
            {messages.length === 0 && !streamingContent ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center max-w-md">
                  <div className={cn("mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl", agent.color)}>
                    <agent.icon className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Chat with {agent.shortName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {agent.description}. Start a conversation or assign a task.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex justify-start mb-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
                          <Wrench className="h-3 w-3" />
                          Used: {msg.toolCalls.map((tc) => tc.name.replace(/_/g, " ")).join(", ")}
                        </div>
                      </div>
                    )}
                    <div className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                      {msg.role === "assistant" && (
                        <div className={cn("mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", agent.color)}>
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.files && msg.files.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.files.map((f, i) => {
                              const Icon = getFileIcon(f.type);
                              return (
                                <span key={i} className="inline-flex items-center gap-1 rounded bg-black/10 px-2 py-0.5 text-xs">
                                  <Icon className="h-3 w-3" />
                                  {f.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {streamingContent && (
                  <div className="flex justify-start">
                    <div className={cn("mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", agent.color)}>
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="max-w-[80%] rounded-lg px-4 py-2.5 text-sm bg-muted">
                      <p className="whitespace-pre-wrap">{streamingContent}</p>
                    </div>
                  </div>
                )}

                {isLoading && !streamingContent && (
                  <div className="flex justify-start">
                    <div className={cn("mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", agent.color)}>
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2.5">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachedFiles.map((f, i) => {
                  const Icon = getFileIcon(f.type);
                  return (
                    <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="max-w-[150px] truncate">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="ml-1 rounded-full hover:bg-background p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.json,.html,.css,.md"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                placeholder={`Message ${agent.shortName}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="min-h-[44px] max-h-[120px] resize-none"
              />
              <Button
                onClick={handleSend}
                disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
