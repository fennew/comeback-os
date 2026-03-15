"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { getAllAgents } from "@/lib/agents/registry";
import { AVAILABLE_MODELS } from "@/lib/agents/providers";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";

interface AgentConfig {
  slug: string;
  model: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  xai: "xAI (Grok)",
  openai: "OpenAI (GPT)",
  google: "Google (Gemini)",
  meta: "Meta (Llama)",
};

function ModelSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm min-w-[180px]"
      disabled={disabled}
    >
      {Object.entries(AVAILABLE_MODELS).map(([key, models]) => (
        <optgroup key={key} label={PROVIDER_LABELS[key] || key}>
          {models.map((m) => (
            <option key={m.model} value={m.model}>{m.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
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
                {Object.entries(AVAILABLE_MODELS).map(([key, models]) => (
                  <optgroup key={key} label={PROVIDER_LABELS[key] || key}>
                    {models.map((m) => (
                      <option key={m.model} value={m.model}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
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
                  <ModelSelect
                    value={currentModel}
                    onChange={(v) => saveModel(agent.slug, v)}
                    disabled={isSaving}
                  />
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
          <p className="text-sm font-medium mb-1">API Configuration</p>
          <p className="text-xs text-muted-foreground">
            All models are powered through OpenRouter — one API key for everything.
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            <li><code className="bg-muted px-1.5 py-0.5 rounded">OPENROUTER_API_KEY</code> — powers all AI models (Claude, GPT, Grok, Gemini, Llama)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
