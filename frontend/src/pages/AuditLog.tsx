import { useState, useMemo } from 'react';
import { useAuditLogs, useAuditActions } from '../hooks/useAuditLogs';
import { useUsers } from '../hooks/useUsers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import SearchInput from '../components/ui/SearchInput';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import {
  List,
  Calendar,
  User,
  Shield,
  LogIn,
  UserPlus,
  UserX,
  UserCheck,
  Shirt,
  CheckCircle2,
  Banknote,
  Calculator,
  Smartphone,
  Settings2,
  Package,
  Trash2,
  Pencil,
  Send,
} from 'lucide-react';

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---- User-agent parser ----
interface DeviceInfo {
  browser: string;
  os: string;
}

function parseUA(ua: string | null): DeviceInfo | null {
  if (!ua) return null;
  let browser = '';
  let os = '';

  if (ua.includes('Edg/')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
  }

  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac OS') || ua.includes('Macintosh')) {
    os = 'macOS';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = ua.includes('iPad') ? 'iPad' : 'iPhone';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  if (!browser && !os) return null;
  return { browser, os };
}

function deviceLabel(info: DeviceInfo | null): string | null {
  if (!info) return null;
  if (info.browser && info.os) return `${info.browser} on ${info.os}`;
  return info.os || info.browser || null;
}

// ---- Action config: color, icon, category ----
const actionConfig: Record<
  string,
  { color: string; icon: React.ReactNode; category: string }
> = {
  login: {
    color:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    icon: <LogIn className="h-3 w-3" />,
    category: 'Auth',
  },
  user_created: {
    color:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    icon: <UserPlus className="h-3 w-3" />,
    category: 'Users',
  },
  user_deactivated: {
    color:
      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    icon: <UserX className="h-3 w-3" />,
    category: 'Users',
  },
  user_reactivated: {
    color:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    icon: <UserCheck className="h-3 w-3" />,
    category: 'Users',
  },
  worker_created: {
    color:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    icon: <UserPlus className="h-3 w-3" />,
    category: 'Workers',
  },
  worker_updated: {
    color:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    icon: <Pencil className="h-3 w-3" />,
    category: 'Workers',
  },
  worker_deactivated: {
    color:
      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    icon: <UserX className="h-3 w-3" />,
    category: 'Workers',
  },
  product_created: {
    color:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    icon: <Package className="h-3 w-3" />,
    category: 'Products',
  },
  product_updated: {
    color:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    icon: <Pencil className="h-3 w-3" />,
    category: 'Products',
  },
  product_deactivated: {
    color:
      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    icon: <Trash2 className="h-3 w-3" />,
    category: 'Products',
  },
  production_created: {
    color:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    icon: <Shirt className="h-3 w-3" />,
    category: 'Production',
  },
  production_approved: {
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3 w-3" />,
    category: 'Production',
  },
  advance_created: {
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    icon: <Banknote className="h-3 w-3" />,
    category: 'Advances',
  },
  advance_approved: {
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3 w-3" />,
    category: 'Advances',
  },
  payroll_run: {
    color:
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    icon: <Calculator className="h-3 w-3" />,
    category: 'Payroll',
  },
  mpesa_pay: {
    color:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    icon: <Send className="h-3 w-3" />,
    category: 'Payments',
  },
  mpesa_bulk_pay: {
    color:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    icon: <Send className="h-3 w-3" />,
    category: 'Payments',
  },
  mpesa_settings_updated: {
    color:
      'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
    icon: <Settings2 className="h-3 w-3" />,
    category: 'Config',
  },
  payment_method_changed: {
    color:
      'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
    icon: <Smartphone className="h-3 w-3" />,
    category: 'Payments',
  },
};

function actionBadge(action: string) {
  const cfg = actionConfig[action];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cfg?.color ?? 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'}`}
    >
      {cfg?.icon}
      {action.replace(/_/g, ' ')}
    </span>
  );
}

// ---- Parse detail string into target and description ----
function parseDetails(action: string, details: string | null) {
  if (!details) return { target: null, desc: null };
  // Format: "Entity Name — extra info" or plain text
  const idx = details.indexOf(' — ');
  if (idx === -1) return { target: null, desc: details };
  return {
    target: details.slice(0, idx),
    desc: details.slice(idx + 3),
  };
}

// ---- Category filter groups ----
const categories = [
  'All',
  'Auth',
  'Users',
  'Workers',
  'Products',
  'Production',
  'Advances',
  'Payroll',
  'Payments',
  'Config',
];

export default function AuditLog() {
  const { data: users } = useUsers();
  const { data: actions } = useAuditActions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterDate, setFilterDate] = useState(today());
  const [filterAction, setFilterAction] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const pageSize = 20;

  const { data: logs, isLoading } = useAuditLogs(
    filterDate,
    filterDate,
    filterAction || undefined,
  );

  const resolveUser = (id: number | null) =>
    id
      ? users?.find((u) => u.id === id)?.username ?? `#${id}`
      : 'system';

  // Build set of actions matching the selected category
  const categoryActions = useMemo(() => {
    if (filterCategory === 'All') return null;
    return new Set(
      Object.entries(actionConfig)
        .filter(([, cfg]) => cfg.category === filterCategory)
        .map(([a]) => a),
    );
  }, [filterCategory]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    let items = logs;
    if (categoryActions) {
      items = items.filter((l) => categoryActions.has(l.action));
    }
    const q = search.toLowerCase();
    if (q) {
      items = items.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          (resolveUser(l.user_id)?.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [logs, search, users, categoryActions]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const approvals = filtered.filter(
      (l) =>
        l.action === 'production_approved' ||
        l.action === 'advance_approved',
    ).length;
    const payments = filtered.filter(
      (l) =>
        l.action === 'mpesa_pay' || l.action === 'mpesa_bulk_pay',
    ).length;
    return {
      total: filtered.length,
      users: new Set(filtered.map((l) => l.user_id).filter(Boolean))
        .size,
      actions: new Set(filtered.map((l) => l.action)).size,
      approvals,
      payments,
    };
  }, [filtered]);

  const dateLabel =
    filterDate === today() ? 'Today' : filterDate;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Audit Log
          </h2>
          <p className="text-muted-foreground text-sm">
            {dateLabel} · {stats.total} events · {stats.actions} action
            types · {stats.users} users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        {[
          {
            label: 'Events',
            value: stats.total,
            icon: <List className="h-4 w-4 text-blue-500" />,
          },
          {
            label: 'Users Active',
            value: stats.users,
            icon: <User className="h-4 w-4 text-green-500" />,
          },
          {
            label: 'Action Types',
            value: stats.actions,
            icon: (
              <Shield className="h-4 w-4 text-purple-500" />
            ),
          },
          {
            label: 'Approvals',
            value: stats.approvals,
            icon: (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ),
          },
          {
            label: 'Payments',
            value: stats.payments,
            icon: (
              <Smartphone className="h-4 w-4 text-cyan-500" />
            ),
          },
        ].map((s) => (
          <Card
            key={s.label}
            className="transition hover:shadow-md"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {s.label}
                </span>
                {s.icon}
              </div>
              <p className="text-lg font-bold">
                {isLoading ? '—' : s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-xs flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search events..."
          />
        </div>
        <Select
          value={filterCategory}
          onValueChange={(v) => {
            setFilterCategory(v || 'All');
            setFilterAction('');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            {filterCategory === 'All'
              ? 'All categories'
              : filterCategory}
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterAction}
          onValueChange={(v) => {
            setFilterAction(v || '');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            {filterAction
              ? filterAction.replace(/_/g, ' ')
              : 'All actions'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All actions</SelectItem>
            {(actions ?? [])
              .filter((a) =>
                categoryActions
                  ? categoryActions.has(a)
                  : true,
              )
              .map((a) => (
                <SelectItem key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {(filterAction ||
          filterCategory !== 'All' ||
          filterDate !== today()) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterAction('');
              setFilterCategory('All');
              setFilterDate(today());
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<List className="h-12 w-12" />}
          title="No events"
          description={
            search || filterAction || filterCategory !== 'All'
              ? 'No matching events.'
              : 'No activity recorded for this date.'
          }
        />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead className="w-28">User</TableHead>
                  <TableHead className="w-36">Action</TableHead>
                  <TableHead className="w-36">Device</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((l) => {
                  const { target, desc } = parseDetails(
                    l.action,
                    l.details,
                  );
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs font-mono align-top pt-3">
                        {new Date(l.event_time).toLocaleTimeString(
                          'en',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'Africa/Nairobi',
                          },
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium align-top pt-3">
                        {resolveUser(l.user_id)}
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        {actionBadge(l.action)}
                      </TableCell>
                      <TableCell className="align-top pt-3 text-xs text-muted-foreground">
                        {l.action === 'login' ? (
                          <div className="space-y-0.5">
                            {deviceLabel(parseUA(l.user_agent)) && (
                              <p className="whitespace-nowrap">
                                {deviceLabel(parseUA(l.user_agent))}
                              </p>
                            )}
                            {l.location && (
                              <p className="whitespace-nowrap">{l.location}</p>
                            )}
                            {l.ip_address && (
                              <p className="whitespace-nowrap font-mono text-[10px] opacity-60">
                                {l.ip_address}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        {target ? (
                          <div>
                            <span className="font-medium text-sm">
                              {target}
                            </span>
                            {desc && (
                              <span className="text-muted-foreground text-sm">
                                {' '}
                                — {desc}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {l.details || '—'}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
