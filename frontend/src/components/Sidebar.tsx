import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Scissors, Wallet, CheckCircle, Users,
  Calculator, BarChart3, Search, Settings, Sun, Moon,
  LogOut, Menu, ChevronDown,
} from 'lucide-react';

const mainItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/production', label: 'Production', icon: Scissors },
  { to: '/workers', label: 'Workers', icon: Users },
  { to: '/advances', label: 'Advances', icon: Wallet },
  { to: '/approvals', label: 'Approvals', icon: CheckCircle },
];

const supervisorItems = [
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/audit', label: 'Audit Log', icon: Search },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const adminItems = [
  { to: '/payroll', label: 'Payroll', icon: Calculator },
];

function NavItem({ item, isActive, onNavigate }: {
  item: typeof mainItems[number];
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className={cn(
        'h-4 w-4 shrink-0 transition-transform duration-200',
        !isActive && 'group-hover:scale-110'
      )} />
      <span>{item.label}</span>
    </Link>
  );
}

function NavGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="space-y-0.5">
      {label && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', collapsed && '-rotate-90')} />
          {label}
        </button>
      )}
      {!collapsed && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, isAdmin, isSupervisor } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { group: 'Main', items: mainItems },
    ...(isSupervisor ? [{ group: 'Management', items: supervisorItems }] : []),
    ...(isAdmin ? [{ group: 'Finance', items: adminItems }] : []),
  ];

  const NavContent = () => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
          <Scissors className="h-4 w-4" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">Johntex</span>
          <p className="text-[10px] text-muted-foreground -mt-0.5">Payroll Management</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {navItems.map((group) => (
          <NavGroup key={group.group} label={group.group}>
            {group.items.map((item) => (
              <NavItem
                key={item.to}
                item={item}
                isActive={isActive(item.to)}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </NavGroup>
        ))}
      </nav>

      <Separator className="mx-3 w-auto" />

      <div className="px-3 py-3 space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={toggle}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-blue-500" />
          )}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </Button>

        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent/50">
          <Avatar className="h-8 w-8 ring-2 ring-sidebar-ring/30">
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {user?.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.username}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => logout()}
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <NavContent />
      </aside>

      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-lg px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-foreground">
          <Menu className="h-5 w-5" />
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0">
            <NavContent />
          </SheetContent>
        </Sheet>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
          <Scissors className="h-3.5 w-3.5" />
        </div>
        <span className="text-base font-bold">Johntex</span>
      </div>
    </>
  );
}
