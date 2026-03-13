"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ClientMetricsPage() {
  const { clientId } = useParams();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clients/${clientId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Client Metrics</h1>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">Connect Klaviyo first</h3>
          <p className="text-sm text-muted-foreground">
            Connect this client&apos;s Klaviyo account to see metrics
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
