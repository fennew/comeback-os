"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENT_CATEGORIES, AGENT_REGISTRY } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-muted-foreground">Your AI-powered agency team</p>
      </div>

      {Object.entries(AGENT_CATEGORIES).map(([key, category]) => (
        <div key={key} className="space-y-3">
          <h2 className="text-lg font-semibold">{category.label}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {category.agents.map((slug) => {
              const agent = AGENT_REGISTRY[slug];
              if (!agent) return null;
              return (
                <Link key={slug} href={`/agents/${slug}`}>
                  <Card className="cursor-pointer transition-colors hover:bg-accent/50 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", agent.color)}>
                          <agent.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm">{agent.name}</CardTitle>
                        </div>
                      </div>
                      <CardDescription className="mt-2 text-xs">
                        {agent.description}
                      </CardDescription>
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {agent.tools.length} tools
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
