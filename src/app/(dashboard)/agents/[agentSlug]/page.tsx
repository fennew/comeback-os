"use client";

import { useParams } from "next/navigation";
import { getAgent } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ListTodo, Wrench, Bot } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useClientContext } from "@/providers/client-context-provider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  toolResults?: Array<{ tool_call_id: string; content: string }>;
  timestamp: Date;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Reset conversation when agent or client changes
  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setStreamingContent("");
  }, [slug, activeClient?.id]);

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input.trim();
    setInput("");
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
                // When a tool result comes in, save current text as a message
                // and start fresh for the next response
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
                // Save final accumulated text
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
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agents/${slug}/tasks`}>
              <ListTodo className="mr-2 h-4 w-4" />
              Tasks
            </Link>
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4" ref={scrollRef}>
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
          <div className="space-y-4 px-1">
            {messages.map((msg) => (
              <div key={msg.id}>
                {/* Tool usage indicator */}
                {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex justify-start mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
                      <Wrench className="h-3 w-3" />
                      Used: {msg.toolCalls.map((tc) => tc.name.replace(/_/g, " ")).join(", ")}
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className={cn("mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", agent.color)}>
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming content */}
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

            {/* Loading indicator */}
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
      <div className="border-t border-border pt-4">
        <div className="flex gap-2">
          <Textarea
            placeholder={`Message ${agent.shortName}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[44px] max-h-[120px] resize-none"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
