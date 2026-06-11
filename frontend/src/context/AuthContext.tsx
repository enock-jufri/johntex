import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import api from '../api/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  isAdmin: boolean;
  isSupervisor: boolean;
  isClerk: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 60 * 1000; // show warning 1 minute before logout
const ACTIVITY_STORAGE_KEY = 'lastActivity';
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

function getStoredActivity(): number {
  const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
  return stored ? parseInt(stored, 10) : Date.now();
}

function updateStoredActivity() {
  localStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(getStoredActivity());
  const logoutRef = useRef<(reason?: string) => void>(() => {});

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleLogout = () => clearAuth();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [clearAuth]);

  const login = useCallback(async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const res = await api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token } = res.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);

    const payload = JSON.parse(atob(access_token.split('.')[1]));
    const userData: User = { id: 0, username: payload.sub, role: payload.role || 'supervisor' };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback((reason?: string) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    if (reason) {
      sessionStorage.setItem('logout_reason', reason);
    }
    clearAuth();
  }, [clearAuth]);

  // Keep logoutRef in sync so the idle timer can always call the latest logout
  logoutRef.current = logout;

  // Clear idle warning when user is no longer authenticated
  useEffect(() => {
    if (!token) {
      setShowIdleWarning(false);
    }
  }, [token]);

  // Inactivity monitoring
  useEffect(() => {
    if (!token) {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    // Initialize last activity on login / tab load
    lastActivityRef.current = getStoredActivity();
    updateStoredActivity();

    // Check if already timed out (e.g., returning to a stale tab)
    const elapsed = Date.now() - lastActivityRef.current;
    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      logout('inactivity');
      return;
    }

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      updateStoredActivity();
      setShowIdleWarning(false);
    };

    // Throttle mousemove to avoid excessive localStorage writes
    let moveThrottle = 0;
    const THROTTLE_MS = 5000;
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - moveThrottle >= THROTTLE_MS) {
        moveThrottle = now;
        handleActivity();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      if (event === 'mousemove') {
        window.addEventListener(event, handleMouseMove, { passive: true });
      } else {
        window.addEventListener(event, handleActivity, { passive: true });
      }
    }

    // Also listen for localStorage changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
        lastActivityRef.current = parseInt(e.newValue, 10);
      }
    };
    window.addEventListener('storage', handleStorage);

    // Check remaining time every second
    idleTimerRef.current = setInterval(() => {
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityRef.current);

      if (remaining <= 0) {
        if (idleTimerRef.current) clearInterval(idleTimerRef.current);
        logoutRef.current('inactivity');
      } else if (remaining <= WARNING_BEFORE_MS) {
        setCountdown(Math.ceil(remaining / 1000));
        setShowIdleWarning(true);
      }
    }, 1000);

    return () => {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      for (const event of ACTIVITY_EVENTS) {
        if (event === 'mousemove') {
          window.removeEventListener(event, handleMouseMove);
        } else {
          window.removeEventListener(event, handleActivity);
        }
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [token, logout]);

  const handleStayLoggedIn = () => {
    lastActivityRef.current = Date.now();
    updateStoredActivity();
    setShowIdleWarning(false);
  };

  const isAdmin = user?.role === 'admin';
  const isSupervisor = isAdmin || user?.role === 'supervisor';
  const isClerk = isSupervisor || user?.role === 'clerk';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isSupervisor, isClerk }}>
      {children}

      <Dialog open={showIdleWarning} onOpenChange={(open) => { if (!open) handleStayLoggedIn(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Session Expiring</DialogTitle>
            <DialogDescription>
              You have been inactive. You will be logged out in {countdown} second{countdown !== 1 ? 's' : ''} for security reasons.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => logout('inactivity')}>
              Logout Now
            </Button>
            <Button onClick={handleStayLoggedIn}>
              Stay Logged In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
