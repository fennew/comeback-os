"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgent } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useClientContext } from "@/providers/client-context-provider";

interface Handoff {
  id: string;
  from_agent_slug: string;
  to_agent_slug: string;
  context: string;
  instructions: string | null;
  status: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  agent_slug: string;
  status: string;
  priority: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

type FilterTab = "all" | "pending" | "processing" | "completed";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badgeClass: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground" },
  processing: { label: "In Progress", icon: Loader2, color: "text-blue-500", badgeClass: "bg-blue-500/10 text-blue-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500", badgeClass: "bg-green-500/10 text-green-500" },
  failed: { label: "Failed", icon: AlertCircle, color: "text-destructive", badgeClass: "bg-destructive/10 text-destructive" },
  review: { label: "Review", icon: AlertCircle, color: "text-yellow-500", badgeClass: "bg-yellow-500/10 text-yellow-500" },
  in_progress: { label: "In Progress", icon: Loader2, color: "text-blue-500", badgeClass: "bg-blue-500/10 text-blue-500" },
};

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ResultsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { activeClient } = useClientContext();

  useEffect(() => {
    fetchResults();
  }, [activeClient?.id]);

  async function fetchResults() {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeClient?.id) params.set("client_id", activeClient.id);

    const res = await fetch(`/api/agents/handoffs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setHandoffs(data.handoffs || []);
      setTasks(data.tasks || []);
    }
    setLoading(false);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Merge handoffs and tasks into a unified timeline
  type ResultItem =
    | { type: "handoff"; data: Handoff; date: string }
    | { type: "task"; data: Task; date: string };

  const allItems: ResultItem[] = [
    ...handoffs.map((h) => ({ type: "handoff" as const, data: h, date: h.created_at })),
    ...tasks.map((t) => ({ type: "task" as const, data: t, date: t.updated_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredItems = allItems.filter((item) => {
    if (activeTab === "all") return true;
    const status = item.type === "handoff" ? item.data.status : item.data.status;
    if (activeTab === "pending") return status === "pending";
    if (activeTab === "processing") return status === "processing" || status === "in_progress";
    if (activeTab === "completed") return status === "completed" || status === "review";
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: allItems.length },
    { key: "pending", label: "Pending", count: allItems.filter((i) => (i.type === "handoff" ? i.data.status : i.data.status) === "pending").length },
    { key: "processing", label: "In Progress", count: allItems.filter((i) => { const s = i.type === "handoff" ? i.data.status : i.data.status; return s === "processing" || s === "in_progress"; }).length },
    { key: "completed", label: "Completed", count: allItems.filter((i) => { const s = i.type === "handoff" ? i.data.status : i.data.status; return s === "completed" || s === "review"; }).length },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground">
          {activeClient ? `Agent work for ${activeClient.name}` : "All agent handoffs and task results"}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {tab.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Results list */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No results yet</h3>
            <p className="text-sm text-muted-foreground">
              Results will appear here when agents complete handoffs and tasks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const id = item.type === "handoff" ? `h-${item.data.id}` : `t-${item.data.id}`;
            const isExpanded = expandedIds.has(id);
            const status = item.type === "handoff" ? item.data.status : item.data.status;
            const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const result = item.type === "handoff" ? item.data.result : item.data.result;

            if (item.type === "handoff") {
              const h = item.data;
              const fromAgent = getAgent(h.from_agent_slug);
              const toAgent = getAgent(h.to_agent_slug);

              return (
                <Card key={id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Agent flow */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {fromAgent ? (
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded", fromAgent.color)}>
                            <fromAgent.icon className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-muted-foreground text-xs font-bold">
                            ?
                          </div>
                        )}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {toAgent ? (
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded", toAgent.color)}>
                            <toAgent.icon className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-muted-foreground text-xs font-bold">
                            ?
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {fromAgent?.shortName || h.from_agent_slug} → {toAgent?.shortName || h.to_agent_slug}
                          </span>
                          <Badge className={cn("text-[10px]", statusCfg.badgeClass)}>
                            <StatusIcon className={cn("h-3 w-3 mr-1", status === "processing" && "animate-spin")} />
                            {statusCfg.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                            {formatTimeAgo(h.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{h.context}</p>

                        {result && (
                          <button
                            onClick={() => toggleExpand(id)}
                            className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isExpanded ? "Hide result" : "Show result"}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && result && (
                      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {result}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }

            // Task result
            const t = item.data;
            const agent = getAgent(t.agent_slug);

            return (
              <Card key={id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {agent ? (
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded shrink-0", agent.color)}>
                        <agent.icon className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-muted-foreground text-xs font-bold shrink-0">
                        ?
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{t.title}</span>
                        <Badge className={cn("text-[10px]", statusCfg.badgeClass)}>
                          <StatusIcon className={cn("h-3 w-3 mr-1", (status === "processing" || status === "in_progress") && "animate-spin")} />
                          {statusCfg.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          {formatTimeAgo(t.updated_at)}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {agent?.shortName || t.agent_slug}
                        </span>
                        <Badge className="text-[10px] bg-muted text-muted-foreground">{t.priority}</Badge>
                      </div>

                      {result && (
                        <button
                          onClick={() => toggleExpand(id)}
                          className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isExpanded ? "Hide result" : "Show result"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && result && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {result}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
