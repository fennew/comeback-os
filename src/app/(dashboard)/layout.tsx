import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ClientContextProvider } from "@/providers/client-context-provider";
import { SidebarProvider } from "@/providers/sidebar-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientContextProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          {/* Desktop sidebar — hidden on mobile */}
          <Sidebar />
          {/* Mobile sidebar — Sheet drawer */}
          <MobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Topbar />
            <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ClientContextProvider>
  );
}
