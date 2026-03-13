"use client";

import { useParams } from "next/navigation";
import { getAgent } from "@/lib/agents/registry";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ListTodo } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AgentTasksPage() {
  const params = useParams();
  const slug = params.agentSlug as string;
  const agent = getAgent(slug);

  if (!agent) {
    return <div className="text-muted-foreground">Agent not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/agents/${slug}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", agent.color)}>
            <agent.icon className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{agent.shortName} Tasks</h1>
            <p className="text-muted-foreground">Tasks assigned to {agent.name}</p>
          </div>
        </div>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No tasks assigned</h3>
          <p className="text-sm text-muted-foreground">
            Chat with {agent.shortName} or the COO to create tasks
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
