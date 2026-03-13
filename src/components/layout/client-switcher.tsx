"use client";

import { Building2, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useClientContext } from "@/providers/client-context-provider";

export function ClientSwitcher() {
  const { activeClient, clients, setActiveClientId } = useClientContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">
              {activeClient ? activeClient.name : "All Clients"}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuItem onClick={() => setActiveClientId(null)}>
          <Building2 className="mr-2 h-4 w-4" />
          All Clients
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {clients.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            No clients yet
          </div>
        ) : (
          clients.map((client) => (
            <DropdownMenuItem
              key={client.id}
              onClick={() => setActiveClientId(client.id)}
              className="gap-2"
            >
              {client.logo_url ? (
                <img src={client.logo_url} alt="" className="h-4 w-4 rounded" />
              ) : (
                <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                  {client.name.charAt(0)}
                </div>
              )}
              <span className="truncate">{client.name}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/clients/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
