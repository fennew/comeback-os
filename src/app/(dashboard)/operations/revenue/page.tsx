"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useClientContext } from "@/providers/client-context-provider";

interface Client {
  id: string;
  name: string;
  monthly_retainer: number | null;
  status: string;
}

export default function RevenuePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const { clients: contextClients } = useClientContext();

  useEffect(() => {
    setClients(contextClients as unknown as Client[]);
  }, [contextClients]);

  const activeClients = clients.filter((c) => c.status === "active");
  const totalMRR = activeClients.reduce(
    (sum, c) => sum + (c.monthly_retainer || 0),
    0
  );
  const avgRetainer = activeClients.length > 0 ? totalMRR / activeClients.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/operations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Revenue</h1>
          <p className="text-muted-foreground">Monthly recurring revenue overview</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Revenue (MRR)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMRR.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {activeClients.length} active clients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Annual
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalMRR * 12).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Based on current MRR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Retainer
            </CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${avgRetainer.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per client per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Client revenue breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Client Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {activeClients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No clients with retainers yet. Add clients and set their monthly retainer to see revenue data.
            </p>
          ) : (
            <div className="space-y-3">
              {activeClients
                .sort((a, b) => (b.monthly_retainer || 0) - (a.monthly_retainer || 0))
                .map((client) => {
                  const pct = totalMRR > 0 ? ((client.monthly_retainer || 0) / totalMRR) * 100 : 0;
                  return (
                    <div key={client.id} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{client.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ${(client.monthly_retainer || 0).toLocaleString()}/mo
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
