"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, FileText } from "lucide-react";
import Link from "next/link";

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations</h1>
        <p className="text-muted-foreground">Agency performance and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/operations/revenue">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <CardTitle className="text-base">Revenue</CardTitle>
                <p className="text-sm text-muted-foreground">Track income and growth</p>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/operations/time-tracking">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <CardTitle className="text-base">Time Tracking</CardTitle>
                <p className="text-sm text-muted-foreground">Agent work hours per client</p>
              </div>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/operations/invoices">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center gap-3">
              <FileText className="h-8 w-8 text-purple-500" />
              <div>
                <CardTitle className="text-base">Invoices</CardTitle>
                <p className="text-sm text-muted-foreground">Create and manage invoices</p>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
