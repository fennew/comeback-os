"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, BarChart3, Plug } from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  brand_colors: string | null;
  brand_voice: string | null;
  industry: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  monthly_retainer: number | null;
  created_at: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients?id=${clientId}`)
      .then((res) => res.json())
      .then((data) => {
        setClient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!client) {
    return <div className="text-muted-foreground">Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-xl font-bold">
              {client.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant={client.status === "active" ? "default" : "secondary"}>
                  {client.status}
                </Badge>
                {client.industry && (
                  <span className="text-sm text-muted-foreground">{client.industry}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${clientId}/metrics`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Metrics
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${clientId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="brand">Brand Data</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Retainer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {client.monthly_retainer ? `$${client.monthly_retainer.toLocaleString()}` : "Not set"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Since</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(client.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Connected</p>
              </CardContent>
            </Card>
          </div>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="brand" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Voice</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {client.brand_voice || "No brand voice defined yet. Edit client settings to add one."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
            </CardHeader>
            <CardContent>
              {client.brand_colors ? (
                <div className="flex gap-2">
                  {client.brand_colors.split(",").map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded border"
                        style={{ backgroundColor: color.trim() }}
                      />
                      <span className="text-sm text-muted-foreground">{color.trim()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No brand colors defined yet.</p>
              )}
            </CardContent>
          </Card>

          {client.website && (
            <Card>
              <CardHeader>
                <CardTitle>Website</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {client.website}
                </a>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plug className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No integrations connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect Klaviyo, Google Drive, and more for this client
              </p>
              <Button variant="outline">Connect Integration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
