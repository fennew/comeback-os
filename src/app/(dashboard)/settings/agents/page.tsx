"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { getAllAgents } from "@/lib/agents/registry";
import { AVAILABLE_MODELS, type ProviderName } from "@/lib/agents/providers";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";

interface AgentConfig {
  slug: string;
  model: string;
}

export default function AgentSettingsPage() {
  const agents = getAllAgents();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [globalModel, setGlobalModel] = useState("");

  // Load existing configs
  useEffect(() => {
    fetch("/api/settings/agents")
      .then((r) => r.json())
      .then((data: AgentConfig[]) => {
        const map: Record<string, string> = {};
        for (const c of data) {
          map[c.slug] = c.model;
        }
        setConfigs(map);
      })
      .catch(() => {});
  }, []);

  async function saveModel(slug: string, model: string) {
    setSaving(slug);
    try {
      const res = await fetch("/api/settings/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, model }),
      });
      if (res.ok) {
        setConfigs((prev) => ({ ...prev, [slug]: model }));
        setSaved(slug);
        setTimeout(() => setSaved(null), 2000);
      }
    } finally {
      setSaving(null);
    }
  }

  async function applyGlobalModel() {
    if (!globalModel) return;
    for (const agent of agents) {
      await saveModel(agent.slug, globalModel);
    }
  }

  const allModels = [
    ...AVAILABLE_MODELS.anthropic,
    ...AVAILABLE_MODELS.xai,
    ...AVAILABLE_MODELS.openai,
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Agent Configuration</h1>
      </div>

      {/* Global model selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Set model for all agents</p>
              <p className="text-xs text-muted-foreground">Change every agent to the same AI model at once</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={globalModel}
                onChange={(e) => setGlobalModel(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select model...</option>
                <optgroup label="xAI (Grok)">
                  {AVAILABLE_MODELS.xai.map((m) => (
                    <option key={m.model} value={m.model}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="OpenAI (GPT)">
                  {AVAILABLE_MODELS.openai.map((m) => (
                    <option key={m.model} value={m.model}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Anthropic (Claude)">
                  {AVAILABLE_MODELS.anthropic.map((m) => (
                    <option key={m.model} value={m.model}>{m.label}</option>
                  ))}
                </optgroup>
              </select>
              <Button size="sm" onClick={applyGlobalModel} disabled={!globalModel}>
                Apply to all
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-agent model selector */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const currentModel = configs[agent.slug] || agent.defaultModel;
          const isSaving = saving === agent.slug;
          const isSaved = saved === agent.slug;

          return (
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
                  <select
                    value={currentModel}
                    onChange={(e) => saveModel(agent.slug, e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm min-w-[180px]"
                    disabled={isSaving}
                  >
                    <optgroup label="Anthropic (Claude)">
                      {AVAILABLE_MODELS.anthropic.map((m) => (
                        <option key={m.model} value={m.model}>{m.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="xAI (Grok)">
                      {AVAILABLE_MODELS.xai.map((m) => (
                        <option key={m.model} value={m.model}>{m.label}</option>
                      ))}
                    </optgroup>
                  </select>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {isSaved && <Check className="h-4 w-4 text-green-500" />}
                  <Badge variant="outline">{agent.tools.length} tools</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* API key info */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-medium mb-1">API Keys</p>
          <p className="text-xs text-muted-foreground">
            Set your API keys as environment variables on Vercel:
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            <li><code className="bg-muted px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code> — for Claude models</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">XAI_API_KEY</code> — for Grok models</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">OPENAI_API_KEY</code> — for GPT models</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
