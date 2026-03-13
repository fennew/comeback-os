"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientContext } from "@/providers/client-context-provider";
import { cn } from "@/lib/utils";

const INTEGRATIONS = [
  {
    key: "klaviyo",
    name: "Klaviyo",
    description: "Email marketing platform — connect per client for metrics, automations, and AI-powered analysis",
    icon: "K",
    color: "bg-green-500/20 text-green-500",
    status: "available" as const,
    fields: [
      { key: "api_key", label: "Private API Key", placeholder: "pk_...", type: "password" },
    ],
  },
  {
    key: "google_drive",
    name: "Google Drive",
    description: "Connect client brand assets and content folders",
    icon: "G",
    color: "bg-blue-500/20 text-blue-500",
    status: "coming_soon" as const,
    fields: [],
  },
  {
    key: "figma",
    name: "Figma",
    description: "Design files and email templates",
    icon: "F",
    color: "bg-purple-500/20 text-purple-500",
    status: "coming_soon" as const,
    fields: [],
  },
  {
    key: "slack",
    name: "Slack",
    description: "Send automated updates and reports to Slack channels",
    icon: "S",
    color: "bg-pink-500/20 text-pink-500",
    status: "coming_soon" as const,
    fields: [],
  },
  {
    key: "shopify",
    name: "Shopify",
    description: "E-commerce data for product recommendations and revenue tracking",
    icon: "S",
    color: "bg-emerald-500/20 text-emerald-500",
    status: "coming_soon" as const,
    fields: [],
  },
];

export default function IntegrationsPage() {
  const { activeClient } = useClientContext();
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function handleSave(integrationKey: string) {
    if (!activeClient) return;
    setSaving(true);

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: activeClient.id,
          provider: integrationKey,
          credentials: formData,
        }),
      });

      if (res.ok) {
        setSaved(integrationKey);
        setConfiguring(null);
        setFormData({});
        setTimeout(() => setSaved(null), 3000);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          {activeClient
            ? `Connect services for ${activeClient.name}`
            : "Select a client to configure integrations"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.key} className={cn(saved === integration.key && "border-green-500/50")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg font-bold", integration.color)}>
                    {integration.icon}
                  </div>
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                </div>
                {saved === integration.key ? (
                  <Badge className="bg-green-500/10 text-green-500">Connected</Badge>
                ) : (
                  <Badge variant={integration.status === "available" ? "default" : "secondary"}>
                    {integration.status === "available" ? "Available" : "Coming Soon"}
                  </Badge>
                )}
              </div>
              <CardDescription>{integration.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {configuring === integration.key ? (
                <div className="space-y-3">
                  {integration.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        type={field.type || "text"}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleSave(integration.key)}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConfiguring(null);
                        setFormData({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={integration.status !== "available" || !activeClient}
                  onClick={() => setConfiguring(integration.key)}
                >
                  {!activeClient
                    ? "Select a client first"
                    : integration.status === "available"
                    ? "Configure"
                    : "Coming Soon"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
