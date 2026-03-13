"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, DollarSign, Calendar } from "lucide-react";
import Link from "next/link";
import { useClientContext } from "@/providers/client-context-provider";

interface Client {
  id: string;
  name: string;
  monthly_retainer: number | null;
  status: string;
  contract_start: string | null;
}

export default function InvoicesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const { clients: contextClients } = useClientContext();

  useEffect(() => {
    setClients(contextClients as unknown as Client[]);
  }, [contextClients]);

  const activeClients = clients.filter(
    (c) => c.status === "active" && c.monthly_retainer && c.monthly_retainer > 0
  );

  const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
  const totalInvoiceable = activeClients.reduce(
    (sum, c) => sum + (c.monthly_retainer || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/operations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Monthly client invoicing overview</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">Current billing period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invoiceable
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInvoiceable.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeClients.length} active retainers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClients.length}</div>
            <p className="text-xs text-muted-foreground mt-1">To generate this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Client Invoices — {currentMonth}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {activeClients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No clients with active retainers. Add clients with monthly retainers to generate invoices.
            </p>
          ) : (
            <div className="space-y-2">
              {activeClients
                .sort((a, b) => (b.monthly_retainer || 0) - (a.monthly_retainer || 0))
                .map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg border border-border"
                  >
                    <div>
                      <p className="font-medium text-sm">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Retainer since{" "}
                        {client.contract_start
                          ? new Date(client.contract_start).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">
                        ${(client.monthly_retainer || 0).toLocaleString()}
                      </span>
                      <Badge variant="outline">Draft</Badge>
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
