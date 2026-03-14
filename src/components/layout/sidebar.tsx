"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  Plug,
  Settings,
  Building2,
  ChevronDown,
  X,
} from "lucide-react";
import { AGENT_CATEGORIES, AGENT_REGISTRY } from "@/lib/agents/registry";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useSidebar } from "@/providers/sidebar-provider";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
];

const bottomNav: NavItem[] = [
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Settings", href: "/settings", icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    operations: true,
    creative: true,
    technical: true,
    business: true,
  });

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          C
        </div>
        <span className="text-lg font-semibold">Comeback OS</span>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {/* Main navigation */}
        <div className="space-y-1">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>

        <Separator className="my-4" />

        {/* Agent categories */}
        <div className="space-y-2">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Agents
          </p>
          {Object.entries(AGENT_CATEGORIES).map(([categoryKey, category]) => (
            <div key={categoryKey}>
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {category.label}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    expandedCategories[categoryKey] ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
              {expandedCategories[categoryKey] && (
                <div className="ml-1 space-y-0.5">
                  {category.agents.map((agentSlug) => {
                    const agent = AGENT_REGISTRY[agentSlug];
                    if (!agent) return null;
                    const href = `/agents/${agent.slug}`;
                    return (
                      <Link
                        key={agent.slug}
                        href={href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                          isActive(href)
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded", agent.color)}>
                          <agent.icon className="h-3 w-3" />
                        </div>
                        {agent.shortName}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        {/* Operations */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Agency
          </p>
          <Link
            href="/operations"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive("/operations")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <BarChart3Icon className="h-4 w-4" />
            Operations
          </Link>
        </div>
      </ScrollArea>

      {/* Bottom navigation */}
      <div className="border-t border-border p-3 space-y-1 shrink-0">
        {bottomNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(item.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// Desktop sidebar — hidden on mobile
export function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r border-border bg-card shrink-0">
      <SidebarNav />
    </aside>
  );
}

// Mobile sidebar — Sheet drawer, controlled by SidebarProvider
export function MobileSidebar() {
  const { isOpen, close } = useSidebar();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="left" className="w-72 p-0 bg-card border-border">
        <SidebarNav onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}

function BarChart3Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
    </svg>
  );
}
