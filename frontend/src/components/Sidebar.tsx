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
  LogOut, Menu,
} from 'lucide-react';

const mainItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
  { to: '/production', label: 'Production', icon: Scissors, color: 'text-green-500' },
  { to: '/workers', label: 'Workers', icon: Users, color: 'text-indigo-500' },
  { to: '/advances', label: 'Advances', icon: Wallet, color: 'text-amber-500' },
  { to: '/approvals', label: 'Approvals', icon: CheckCircle, color: 'text-purple-500' },
];

const supervisorItems = [
  { to: '/analytics', label: 'Analytics', icon: BarChart3, color: 'text-blue-500' },
  { to: '/audit', label: 'Audit Log', icon: Search, color: 'text-gray-500' },
  { to: '/settings', label: 'Settings', icon: Settings, color: 'text-gray-500' },
];

const adminItems = [
  { to: '/payroll', label: 'Payroll', icon: Calculator, color: 'text-rose-500' },
];

export default function Sidebar() {
  const { user, logout, isAdmin, isSupervisor } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    ...mainItems,
    ...(isSupervisor ? supervisorItems : []),
    ...(isAdmin ? adminItems : []),
  ];

  const NavContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20">
          <Scissors className="h-4 w-4" />
        </div>
        <span className="text-lg font-bold tracking-tight">Johntex</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-primary-foreground' : item.color)} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="px-3 py-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={toggle}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-blue-600" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>

        <div className="flex items-center gap-3 px-1 py-1">
          <Avatar className="h-8 w-8 bg-primary/10">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => logout()} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <NavContent />
      </aside>

      {/* Mobile header + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card px-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0">
            <NavContent />
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-foreground">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600">
          <Scissors className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">Johntex</span>
      </div>
    </>
  );
}
