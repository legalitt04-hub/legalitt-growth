import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

// ─── Permission map matching backend roleController.js ─────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin:           ['dashboard','users','advocates','cases','consultations','ads','roles','earnings','withdrawals','settings','support','reviews','reports','audit','notifications'],
  admin:                 ['dashboard','users','advocates','cases','consultations','earnings','withdrawals','support','reviews','reports','notifications'],
  support_executive:     ['dashboard','consultations','support','notifications'],
  accounts:              ['dashboard','earnings','withdrawals','reports'],
  forensic_expert:       ['dashboard','documents','document_forensic'],
  property_verification: ['dashboard','documents','property_research'],
};

// Map permission key → allowed paths
const PERMISSION_PATH_MAP: Record<string, string[]> = {
  dashboard:     ['/'],
  users:         ['/users'],
  advocates:     ['/advocates', '/pending-advocates', '/verification'],
  cases:         ['/cases', '/fir-drafts', '/legal-notices'],
  consultations: ['/consultations', '/chats', '/calendar', '/call-history'],
  ads:           ['/ads'],
  roles:         ['/roles', '/admins'],
  earnings:      ['/earnings', '/coupons', '/payment-history', '/transactions', '/pricing'],
  withdrawals:   ['/withdrawals'],
  settings:      ['/settings'],
  support:       ['/support'],
  reviews:       ['/reviews'],
  reports:       ['/reports'],
  audit:         ['/audit-logs'],
  notifications: ['/notifications'],
  documents:     ['/documents', '/ai-drafts', '/categories', '/services'],
  document_forensic: ['/document-forensic'],
  property_research: ['/property-research'],
};

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  displayRole: string;
  avatar?: string;
  permissions: string[];
  allowedPaths: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (token: string, userData?: AdminUser) => void;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  canAccess: (path: string) => boolean;
}

const ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support_executive: 'Support Executive',
  accounts: 'Accounts',
  forensic_expert: 'Forensic Expert',
  property_verification: 'Property Verification',
};

function buildUser(raw: any): AdminUser {
  const aliases: Record<string, string> = { superadmin: 'super_admin', support: 'support_executive' };
  const role = aliases[raw.role] || raw.role || '';
  const perms = ROLE_PERMISSIONS[role] || [];
  const paths = perms.flatMap(p => PERMISSION_PATH_MAP[p] || []);
  return {
    _id: raw._id,
    name: raw.name,
    email: raw.email,
    role,
    displayRole: ROLE_DISPLAY[role] || raw.role,
    avatar: raw.avatar,
    permissions: perms,
    allowedPaths: [...new Set(paths)],
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('adminToken'));
  const [user, setUser] = useState<AdminUser | null>(() => {
    try { const s = localStorage.getItem('adminUser'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        const rawUser = res.data.data;
        const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
        if (!ADMIN_ROLES.includes(rawUser?.role)) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }
        const built = buildUser(rawUser);
        setUser(built);
        localStorage.setItem('adminUser', JSON.stringify(built));
        setIsAuthenticated(true);
      }
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setIsAuthenticated(false);
        setUser(null);
      } else {
        // Preserve the cached admin session during temporary network/server outages.
        const cached = localStorage.getItem('adminUser');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
            setIsAuthenticated(true);
          } catch { /* invalid cache is handled on the next authenticated response */ }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        window.history.replaceState(null, '', window.location.pathname);
        setIsLoading(true);
        api.post('/auth/google', { accessToken }).then(res => {
          const token = res.data.data?.accessToken || res.data.token || res.data.accessToken;
          const rawUser = res.data.data?.user || res.data.data;
          const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
          if (res.data?.success && token && rawUser && ADMIN_ROLES.includes(rawUser.role)) {
            const built = buildUser(rawUser);
            localStorage.setItem('adminToken', token);
            localStorage.setItem('adminUser', JSON.stringify(built));
            setUser(built);
            setIsAuthenticated(true);
            connectSocket(token);
          } else {
            const userEmail = rawUser?.email || '';
            const msg = `Access Denied: ${userEmail ? `"${userEmail}"` : 'This email'} is not registered as an Admin. Contact your Super Admin.`;
            sessionStorage.setItem('admin_login_error', msg);
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            setIsAuthenticated(false);
            setUser(null);
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
        }).catch(() => {
          refreshUser();
        }).finally(() => setIsLoading(false));
        return;
      }
    }
    refreshUser();
  }, [refreshUser]);

  const login = (token: string, userData?: AdminUser) => {
    localStorage.setItem('adminToken', token);
    if (userData) {
      localStorage.setItem('adminUser', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthenticated(true);
    // Connect socket with token for real-time admin events
    connectSocket(token);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setIsAuthenticated(false);
    setUser(null);
    disconnectSocket();
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    return user.allowedPaths.some(allowed => path === allowed || path.startsWith(`${allowed}/`));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading, refreshUser, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
