import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { OnlineIndicator } from "@/components/app/OnlineIndicator";
import { useAuth } from "@/store/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 px-4 border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
            <OnlineIndicator />
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border/60">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight pr-1">
                <div className="text-xs font-medium">{user.name}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{user.role}</div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}