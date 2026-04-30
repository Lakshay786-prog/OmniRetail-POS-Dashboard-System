import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ScanBarcode, Package, Boxes, ReceiptText, LogOut, Sparkles } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { title: "POS", url: "/pos", icon: ScanBarcode, roles: ["admin", "cashier"] },
  { title: "Products", url: "/products", icon: Package, roles: ["admin", "manager"] },
  { title: "Inventory", url: "/inventory", icon: Boxes, roles: ["admin", "manager"] },
  { title: "Orders", url: "/orders", icon: ReceiptText, roles: ["admin", "manager", "cashier"] },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const visible = items.filter((i) => !user || i.roles.includes(user.role as never));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-accent flex items-center justify-center shadow-glow">
            <Sparkles className="h-4 w-4 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-base font-semibold text-sidebar-foreground">Hearth</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">Retail OS</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-[0.18em]">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary-foreground transition-smooth">
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                        {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="rounded-lg bg-sidebar-accent/40 p-3 mb-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">Signed in</div>
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</div>
            <div className="text-[11px] text-sidebar-foreground/60 capitalize">{user.role} · {user.store}</div>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}