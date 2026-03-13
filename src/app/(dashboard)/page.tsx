"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientContext } from "@/providers/client-context-provider";
import { Building2, ListTodo, Users, Zap } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { clients, activeClient } = useClientContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {activeClient ? activeClient.name : "Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {activeClient
            ? "Client overview and quick actions"
            : "Welcome to Comeback OS - your AI-powered agency"}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">Ready to work</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Automations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Active flows</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/clients/new">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="text-base">Add New Client</CardTitle>
              <CardDescription>Set up a new client workspace with brand data</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/agents/coo">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="text-base">Talk to COO</CardTitle>
              <CardDescription>Get your head of operations to assign work</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/agents/copywriter">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="text-base">Start Writing</CardTitle>
              <CardDescription>Chat with the copywriter to draft emails</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
