"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgent } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, Circle, AlertCircle, ListTodo } from "lucide-react";
import { useClientContext } from "@/providers/client-context-provider";

interface Task {
  id: string;
  title: string;
  description: string | null;
  agent_slug: string;
  status: string;
  priority: string;
  client_id: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLUMNS = [
  { key: "pending", label: "Pending", icon: Circle, color: "text-muted-foreground" },
  { key: "in_progress", label: "In Progress", icon: Clock, color: "text-blue-500" },
  { key: "review", label: "Review", icon: AlertCircle, color: "text-yellow-500" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-green-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-destructive/10 text-destructive",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeClient } = useClientContext();

  useEffect(() => {
    fetchTasks();
  }, [activeClient?.id]);

  async function fetchTasks() {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeClient?.id) params.set("client_id", activeClient.id);

    const res = await fetch(`/api/agents/tasks?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data);
    }
    setLoading(false);
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    await fetch("/api/agents/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
    fetchTasks();
  }

  function getTasksByStatus(status: string) {
    return tasks.filter((t) => t.status === status);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Task Board</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Task Board</h1>
          <p className="text-muted-foreground">
            {activeClient ? `Tasks for ${activeClient.name}` : "All agency tasks"}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No tasks yet</h3>
            <p className="text-sm text-muted-foreground">
              Tasks will appear here when agents start working. Chat with an agent to create tasks.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Task Board</h1>
        <p className="text-muted-foreground">
          {activeClient ? `Tasks for ${activeClient.name}` : "All agency tasks"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_COLUMNS.map((col) => {
          const columnTasks = getTasksByStatus(col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <col.icon className={cn("h-4 w-4", col.color)} />
                <span className="text-sm font-medium">{col.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {columnTasks.length}
                </Badge>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {columnTasks.map((task) => {
                  const agent = getAgent(task.agent_slug);
                  return (
                    <Card key={task.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{task.title}</p>
                          <Badge className={cn("text-[10px] shrink-0", PRIORITY_COLORS[task.priority])}>
                            {task.priority}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          {agent && (
                            <div className="flex items-center gap-1.5">
                              <div className={cn("flex h-5 w-5 items-center justify-center rounded", agent.color)}>
                                <agent.icon className="h-3 w-3" />
                              </div>
                              <span className="text-xs text-muted-foreground">{agent.shortName}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {col.key !== "completed" && (
                          <div className="flex gap-1 pt-1">
                            {col.key === "pending" && (
                              <Button variant="ghost" size="xs" onClick={() => updateTaskStatus(task.id, "in_progress")}>
                                Start
                              </Button>
                            )}
                            {col.key === "in_progress" && (
                              <Button variant="ghost" size="xs" onClick={() => updateTaskStatus(task.id, "review")}>
                                Review
                              </Button>
                            )}
                            {col.key === "review" && (
                              <Button variant="ghost" size="xs" onClick={() => updateTaskStatus(task.id, "completed")}>
                                Approve
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
                    <p className="text-xs text-muted-foreground">No tasks</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
