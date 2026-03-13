"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getAllAgents } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function AgentSettingsPage() {
  const agents = getAllAgents();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Agent Configuration</h1>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <Card key={agent.slug}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", agent.color)}>
                  <agent.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{agent.defaultModel}</Badge>
                <Badge variant="outline">{agent.tools.length} tools</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
