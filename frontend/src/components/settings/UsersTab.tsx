import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  useUsers,
  useRoles,
  useCreateUser,
  useToggleUserActive,
  useUserActivity,
  usePermissions,
  useResetPassword,
  type User,
} from '../../hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import SearchInput from '../ui/SearchInput';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  Plus,
  Check,
  X,
  Settings2,
  Clock,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Zap,
  History,
  UserX,
  UserCheck,
  RefreshCw,
  UserPlus,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserIcon,
  Key,
} from 'lucide-react';

const pageSize = 8;

function Skeletons({ n }: { n: number }) {
  return <div className="space-y-2">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
}

function passwordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
  checks: { label: string; pass: boolean }[];
} {
  const checks = [
    { label: 'At least 8 characters', pass: pw.length >= 8 },
    { label: 'Contains uppercase letter', pass: /[A-Z]/.test(pw) },
    { label: 'Contains lowercase letter', pass: /[a-z]/.test(pw) },
    { label: 'Contains a number', pass: /[0-9]/.test(pw) },
    { label: 'Contains a special character', pass: /[^A-Za-z0-9]/.test(pw) },
  ];
  const passed = checks.filter((c) => c.pass).length;
  if (passed <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500', checks };
  if (passed <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500', checks };
  if (passed <= 4) return { score: 3, label: 'Good', color: 'bg-yellow-400', checks };
  return { score: 4, label: 'Strong', color: 'bg-emerald-500', checks };
}

function securityScore(
  users: User[] | undefined,
  roles: { id: number; name: string }[] | undefined,
  now: Date,
): { level: string; icon: React.ReactNode; color: string; issues: string[] } {
  if (!users || users.length === 0)
    return { level: 'N/A', icon: <Shield className="h-5 w-5" />, color: 'text-gray-500', issues: [] };
  const issues: string[] = [];

  const roleName = (id: number) => roles?.find((r) => r.id === id)?.name ?? `#${id}`;

  const admins = users.filter((u) => u.active && u.role_id === 1);
  const supervisors = users.filter((u) => u.active && roleName(u.role_id) === 'supervisor');
  const inactive = users.filter((u) => !u.active);
  const staleLogins = users.filter((u) => {
    if (!u.last_login || !u.active) return false;
    const days = (now.getTime() - new Date(u.last_login).getTime()) / 86400000;
    return days > 30;
  });
  const neverLoggedIn = users.filter((u) => u.active && !u.last_login);
  const activeUsers = users.filter((u) => u.active);
  const activeRoles = new Set(activeUsers.map((u) => roleName(u.role_id)));

  if (admins.length === 0) issues.push('No active admin account — system unmanageable');
  if (admins.length === 1) issues.push('Only one admin — no redundancy if unavailable');

  if (supervisors.length === 0 && activeUsers.length > 0)
    issues.push('No active supervisor — all operations need admin intervention');
  if (activeRoles.size === 1 && activeUsers.length > 1)
    issues.push(`All ${activeUsers.length} users in one role — no separation of duties`);

  if (neverLoggedIn.length > 0)
    issues.push(`${neverLoggedIn.length} active user${neverLoggedIn.length > 1 ? 's' : ''} never logged in — remove or enforce first login`);
  if (staleLogins.length > 0)
    issues.push(`${staleLogins.length} user${staleLogins.length > 1 ? 's' : ''} not logged in for 30+ days — review access`);
  if (inactive.length >= 3) issues.push(`${inactive.length} inactive accounts — consider cleanup`);

  const weakUsernames = activeUsers.filter((u) => u.username === 'admin' || u.username === 'user' || u.username === 'test');
  if (weakUsernames.length > 0) issues.push('Generic usernames detected — easier to target in attacks');

  if (issues.length === 0)
    return { level: 'Healthy', icon: <ShieldCheck className="h-5 w-5" />, color: 'text-emerald-500', issues };
  if (issues.length <= 2)
    return { level: 'Needs Review', icon: <AlertTriangle className="h-5 w-5" />, color: 'text-amber-500', issues };
  return { level: 'At Risk', icon: <ShieldAlert className="h-5 w-5" />, color: 'text-red-500', issues };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + '+03:00';
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const actionLabels: Record<string, string> = {
  login: 'Logged in',
  user_created: 'Created user',
  user_deactivated: 'Deactivated user',
  user_reactivated: 'Reactivated user',
  user_password_reset: 'Reset password',
  production_created: 'Logged production',
  production_approved: 'Approved production',
  advance_created: 'Created advance',
  advance_approved: 'Approved advance',
  payroll_run: 'Ran payroll',
  mpesa_pay: 'Sent M-Pesa payment',
  mpesa_bulk_pay: 'Sent bulk payment',
  mpesa_settings_updated: 'Updated M-Pesa settings',
  payment_method_changed: 'Changed payment method',
  worker_created: 'Added worker',
  worker_updated: 'Updated worker',
  worker_deactivated: 'Deactivated worker',
  product_created: 'Added product',
  product_updated: 'Updated product',
  product_deactivated: 'Deactivated product',
};

export default function UsersTab() {
  const { data: users, isLoading } = useUsers();
  const { data: roles } = useRoles();
  const { data: permissions } = usePermissions();
  const { data: activities } = useUserActivity();
  const createUser = useCreateUser();
  const toggleActive = useToggleUserActive();
  const resetPassword = useResetPassword();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<number | null>(null);

  const roleName = (id: number) => roles?.find((r) => r.id === id)?.name ?? `#${id}`;

  const strength = passwordStrength(password);
  const now = new Date();
  const secScore = securityScore(users, roles, now);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.toLowerCase();
    return users.filter((u) => u.username.toLowerCase().includes(q) || roleName(u.role_id).toLowerCase().includes(q));
  }, [users, search, roles]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !roleId) return;
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try {
      await createUser.mutateAsync({ username, password, role_id: Number(roleId) });
      toast.success('User created');
      setUsername(''); setPassword(''); setRoleId('');
    } catch { toast.error('Failed to create user'); }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await toggleActive.mutateAsync(id);
      toast.success(active ? 'User deactivated' : 'User reactivated');
      setConfirmTarget(null);
    } catch { toast.error('Failed'); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword || newPassword.length < 6) return;
    try {
      await resetPassword.mutateAsync({ userId: resetTarget, password: newPassword });
      toast.success('Password reset');
      setResetTarget(null); setNewPassword(''); setShowResetPassword(false);
    } catch { toast.error('Failed to reset password'); }
  };

  const userActivityMap = useMemo(() => {
    const map: Record<number, { total_actions: number; recent_actions: string[]; last_login: string | null }> = {};
    (activities ?? []).forEach((a) => {
      map[a.user_id] = {
        total_actions: a.total_actions,
        recent_actions: a.recent_actions,
        last_login: a.last_login,
      };
    });
    return map;
  }, [activities]);

  return (
    <div className="space-y-4">
      {/* Security Scorecard */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Security Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <span className={secScore.color}>{secScore.icon}</span>
              <div>
                <p className={`text-lg font-bold ${secScore.color}`}>{secScore.level}</p>
                <p className="text-xs text-muted-foreground">{users?.length ?? 0} users · {users?.filter((u) => u.active).length ?? 0} active</p>
              </div>
            </div>
            {secScore.issues.length > 0 && (
              <ul className="space-y-1">
                {secScore.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />{issue}
                  </li>
                ))}
              </ul>
            )}
            {secScore.issues.length === 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">All security checks passed — no issues found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Role Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.entries(permissions ?? {}) as [string, string[]][]).map(([role, perms]) => (
              <div key={role}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{role}</p>
                <ul className="space-y-0.5">
                  {perms.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500 flex-shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Add User Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. john" required autoComplete="off" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 chars" required className="w-44 pr-8" autoComplete="new-password" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {password && (
              <div className="space-y-1 self-end mb-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div key={level} className={`h-1 w-8 rounded-full transition-colors ${level <= strength.score ? strength.color : 'bg-gray-200 dark:bg-gray-700'}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Role</label>
              <Select value={roleId} onValueChange={(v) => setRoleId(v || '')}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Role..." /></SelectTrigger>
                <SelectContent>
                  {(roles ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={createUser.isPending}>
              {createUser.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Add
            </Button>
          </form>
          {password && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              {strength.checks.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  {c.pass ? <Check className="h-3 w-3 text-emerald-500" /> : <X className="h-3 w-3 text-red-400" />}
                  <span className={c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Users ({filtered.length})</CardTitle>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users..." />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeletons n={3} /> : filtered.length === 0 ? (
            <EmptyState icon={<Shield className="h-12 w-12" />} title="No users" description={search ? 'No match.' : 'Add one above.'} />
          ) : (
            <div className="divide-y">
              {paged.map((u) => {
                const activity = userActivityMap[u.id];
                const isExpanded = expandedUser === u.id;
                const role = roleName(u.role_id);

                return (
                  <div key={u.id} className={`py-3 transition-colors ${isExpanded ? 'bg-muted/30 -mx-4 px-4 rounded-lg' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`relative flex items-center justify-center h-9 w-9 rounded-full flex-shrink-0 ${u.active ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                        <UserIcon className={`h-4 w-4 ${u.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background flex items-center justify-center ${role === 'admin' ? 'bg-purple-500' : role === 'supervisor' ? 'bg-blue-500' : 'bg-gray-400'}`} title={role}>
                          <Key className="h-2 w-2 text-white" />
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{u.username}</p>
                          <Badge variant={u.active ? 'default' : 'destructive'} className="text-xs">{u.active ? 'Active' : 'Inactive'}</Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{role}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last login: {timeAgo(activity?.last_login || u.last_login)}</span>
                          {activity && <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{activity.total_actions} actions</span>}
                          <span className="flex items-center gap-1"><History className="h-3 w-3" />Created {timeAgo(u.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setExpandedUser(isExpanded ? null : u.id)}>{isExpanded ? 'Less' : 'Details'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResetTarget(u.id); setNewPassword(''); setShowResetPassword(false); }}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />Reset PW
                        </Button>
                        <Button size="sm" variant={u.active ? 'destructive' : 'default'} onClick={() => setConfirmTarget(u.id)}>
                          {u.active ? <><UserX className="h-3.5 w-3.5 mr-1" />Deactivate</> : <><UserCheck className="h-3.5 w-3.5 mr-1" />Activate</>}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pl-12 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-muted-foreground">Username</p><p className="font-medium">{u.username}</p></div>
                          <div><p className="text-muted-foreground">Role</p><p className="font-medium capitalize">{role}</p></div>
                          <div><p className="text-muted-foreground">Account created</p><p className="font-medium">{new Date(u.created_at).toLocaleDateString()}</p></div>
                          <div><p className="text-muted-foreground">Last login</p><p className="font-medium">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</p></div>
                        </div>
                        {activity && activity.recent_actions.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Recent activity</p>
                            <div className="flex flex-wrap gap-1">
                              {activity.recent_actions.map((a, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{actionLabels[a] ?? a.replace(/_/g, ' ')}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {permissions && permissions[role] && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Permissions</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                              {permissions[role].map((p, i) => (
                                <span key={i} className="text-xs text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" />{p}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length > pageSize && <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />}
        </CardContent>
      </Card>

      {/* Deactivate Confirmation */}
      <Dialog open={confirmTarget !== null} onOpenChange={() => setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget !== null && users?.find((u) => u.id === confirmTarget)?.active ? 'Deactivate User' : 'Reactivate User'}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget !== null && users?.find((u) => u.id === confirmTarget)?.active
                ? `Are you sure you want to deactivate ${users?.find((u) => u.id === confirmTarget)?.username}? They will no longer be able to log in.`
                : `Reactivate ${users?.find((u) => u.id === confirmTarget)?.username}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button
              variant={confirmTarget !== null && users?.find((u) => u.id === confirmTarget)?.active ? 'destructive' : 'default'}
              onClick={() => { const user = users?.find((u) => u.id === confirmTarget); if (user) handleToggle(user.id, user.active); }}
            >
              {confirmTarget !== null && users?.find((u) => u.id === confirmTarget)?.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetTarget !== null} onOpenChange={() => { setResetTarget(null); setNewPassword(''); setShowResetPassword(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for <strong>{users?.find((u) => u.id === resetTarget)?.username}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New Password</label>
              <div className="relative">
                <Input type={showResetPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className="pr-8" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowResetPassword(!showResetPassword)}>
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {newPassword && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => {
                    const s = passwordStrength(newPassword);
                    return <div key={level} className={`h-1 w-full rounded-full transition-colors ${level <= s.score ? s.color : 'bg-gray-200 dark:bg-gray-700'}`} />;
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{passwordStrength(newPassword).label}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword(''); }}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetPassword.isPending || newPassword.length < 6}>
              {resetPassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
