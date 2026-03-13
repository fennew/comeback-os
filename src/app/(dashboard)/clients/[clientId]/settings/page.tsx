"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ClientSettingsPage() {
  const { clientId } = useParams();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clients/${clientId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Client Settings</h1>
      </div>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Client settings coming soon
        </CardContent>
      </Card>
    </div>
  );
}
