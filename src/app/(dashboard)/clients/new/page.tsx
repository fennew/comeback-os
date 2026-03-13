"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientContext } from "@/providers/client-context-provider";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const router = useRouter();
  const { refreshClients } = useClientContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      industry: formData.get("industry") as string || null,
      website: formData.get("website") as string || null,
      brand_voice: formData.get("brand_voice") as string || null,
      brand_colors: formData.get("brand_colors") as string || null,
      notes: formData.get("notes") as string || null,
      monthly_retainer: formData.get("monthly_retainer")
        ? parseFloat(formData.get("monthly_retainer") as string)
        : null,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create client");
      }

      const client = await res.json();
      await refreshClients();
      router.push(`/clients/${client.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Client</h1>
          <p className="text-muted-foreground">Set up a new client workspace</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
            <CardDescription>
              This data will be used by all agents when working on this client
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Client / Brand Name *</Label>
              <Input id="name" name="name" placeholder="e.g. Acme Corp" required />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" placeholder="e.g. E-commerce, SaaS, Fashion" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" type="url" placeholder="https://example.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand_voice">Brand Voice</Label>
              <Textarea
                id="brand_voice"
                name="brand_voice"
                placeholder="Describe the brand's tone and voice. e.g. Professional but friendly, uses humor, speaks directly to young professionals..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand_colors">Brand Colors</Label>
              <Input
                id="brand_colors"
                name="brand_colors"
                placeholder="e.g. #FF5733, #2C3E50, #ECF0F1"
              />
              <p className="text-xs text-muted-foreground">Comma-separated hex codes</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_retainer">Monthly Retainer ($)</Label>
              <Input
                id="monthly_retainer"
                name="monthly_retainer"
                type="number"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any additional information about the client..."
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" type="button" asChild>
                <Link href="/clients">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
