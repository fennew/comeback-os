"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Bot, Timer } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface TimeEntry {
  id: string;
  agent_slug: string;
  description: string;
  duration_ms: number;
  created_at: string;
  client: { name: string } | null;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const agentNames: Record<string, string> = {
  coo: "COO",
  copywriter: "Copywriter",
  "email-strategist": "Email Strategist",
  "subject-line-creator": "Subject Line Creator",
  "email-designer": "Email Designer",
  "data-analyst": "Data Analyst",
  "deliverability-specialist": "Deliverability Specialist",
  "automation-specialist": "Automation Specialist",
  "account-manager": "Account Manager",
  "data-tracker": "Data Tracker",
  "finance-manager": "Finance Manager",
  "onboarding-specialist": "Onboarding Specialist",
  "outbound-strategist": "Outbound Strategist",
  "proposal-writer": "Proposal Writer",
  "co-ceo": "Co-CEO",
};

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return;

      const { data } = await supabase
        .from("time_entries")
        .select("id, agent_slug, description, duration_ms, created_at, client:clients(name)")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false })
        .limit(50);

      setEntries((data as unknown as TimeEntry[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const totalMs = entries.reduce((sum, e) => sum + (e.duration_ms || 0), 0);
  const agentBreakdown: Record<string, number> = {};
  for (const e of entries) {
    agentBreakdown[e.agent_slug] = (agentBreakdown[e.agent_slug] || 0) + (e.duration_ms || 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/operations"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
          <p className="text-muted-foreground">Auto-tracked agent work time</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalMs)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {entries.length} tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
            <Bot className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(agentBreakdown).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Agents with logged time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Task Duration</CardTitle>
            <Timer className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.length > 0 ? formatDuration(totalMs / entries.length) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per completed task</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent breakdown */}
      {Object.keys(agentBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Time by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(agentBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([slug, ms]) => {
                  const pct = totalMs > 0 ? (ms / totalMs) * 100 : 0;
                  return (
                    <div key={slug} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{agentNames[slug] || slug}</span>
                          <span className="text-sm text-muted-foreground">{formatDuration(ms)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No time entries yet. Agent work time is automatically tracked when tasks are executed.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">
                        {agentNames[entry.agent_slug] || entry.agent_slug}
                      </Badge>
                      {entry.client && (
                        <span className="text-xs text-muted-foreground">{entry.client.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-mono">{formatDuration(entry.duration_ms)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
