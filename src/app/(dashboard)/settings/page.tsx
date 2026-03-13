"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Key, Bot, Shield, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [agencyName, setAgencyName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;
      setOrgId(membership.organization_id);

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .single();

      if (org) {
        setAgencyName(org.name);
        setOriginalName(org.name);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!orgId || agencyName === originalName) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({ name: agencyName, updated_at: new Date().toISOString() })
      .eq("id", orgId);
    setOriginalName(agencyName);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your agency and account settings</p>
      </div>

      {/* Agency Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Agency Profile</CardTitle>
              <CardDescription>Your agency branding and information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agency-name">Agency Name</Label>
            <Input
              id="agency-name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Your Agency Name"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Email</Label>
            <Input value={userEmail} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || agencyName === originalName}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check className="h-4 w-4 mr-2" /> Saved</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for AI and integrations</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Claude API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                value="••••••••••••••••"
                disabled
                className="font-mono opacity-60"
              />
              <Badge variant={process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY === "true" ? "default" : "destructive"}>
                {process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY === "true" ? "Connected" : "Not Set"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Set ANTHROPIC_API_KEY in your .env.local file. Get one from{" "}
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="underline">
                console.anthropic.com
              </a>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Inngest</Label>
            <div className="flex items-center gap-2">
              <Input
                value="••••••••••••••••"
                disabled
                className="font-mono opacity-60"
              />
              <Badge variant="secondary">Dev Mode</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Inngest runs locally in dev mode. Configure INNGEST_SIGNING_KEY for production.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Agent Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>View and manage your AI agent team</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Configure agent models, prompts, and tool access. You have 15 specialized agents ready to work.
          </p>
          <Button variant="outline" asChild>
            <Link href="/settings/agents">Manage Agents →</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Security</CardTitle>
              <CardDescription>Account security and data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Row Level Security</p>
              <p className="text-xs text-muted-foreground">All database tables protected with RLS</p>
            </div>
            <Badge>Enabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Multi-Tenant Isolation</p>
              <p className="text-xs text-muted-foreground">Data isolated per organization</p>
            </div>
            <Badge>Active</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
