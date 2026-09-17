import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google';
import { Mail, Lock, Eye, EyeOff, Shield, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

type LoginMode = 'password' | 'otp' | 'google';
type OtpStep = 'email' | 'verify';

const ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support_executive: 'Support Executive',
  accounts: 'Accounts',
  forensic_expert: 'Forensic Expert',
  property_verification: 'Property Verification',
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin:           ['dashboard','users','advocates','cases','consultations','ads','roles','earnings','withdrawals','settings','support','reviews','reports','audit','notifications'],
  admin:                 ['dashboard','users','advocates','cases','consultations','earnings','withdrawals','support','reviews','reports','notifications'],
  support_executive:     ['dashboard','consultations','support','notifications'],
  accounts:              ['dashboard','earnings','withdrawals','reports'],
  forensic_expert:       ['dashboard','documents','document_forensic'],
  property_verification: ['dashboard','documents','property_research'],
};

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

function buildUser(raw: any) {
  const aliases: Record<string, string> = { superadmin: 'super_admin', support: 'support_executive' };
  const role = aliases[raw.role] || raw.role || '';
  const perms = ROLE_PERMISSIONS[role] || [];
  const paths = perms.flatMap((p: string) => PERMISSION_PATH_MAP[p] || []);
  return {
    _id: raw._id, name: raw.name, email: raw.email,
    role, displayRole: ROLE_DISPLAY[role] || role,
    avatar: raw.avatar, permissions: perms,
    allowedPaths: [...new Set(paths)],
  };
}

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>('password');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');

  // Password login state
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP state
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const finishLogin = (token: string, user: any) => {
    const built = buildUser(user);
    login(token, built as any);
    navigate('/');
  };

  const startCountdown = () => {
    setCountdown(60);
    const iv = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
    }, 1000);
  };

  React.useEffect(() => {
    const sessionErr = sessionStorage.getItem('admin_login_error');
    if (sessionErr) {
      setError(sessionErr);
      sessionStorage.removeItem('admin_login_error');
      setMode('google');
    }
  }, []);

  // ─── Password Login ──────────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.toLowerCase().trim(), password });
      const token = res.data.data?.accessToken || res.data.token || res.data.accessToken;
      const userData = res.data.data?.user || res.data.data;
      if (res.data?.success && token) {
        const adminRoles = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
        if (!adminRoles.includes(userData?.role)) {
          setError(`Access Denied: "${email}" is not registered as an Admin. Contact your Super Admin.`);
          setLoading(false);
          return;
        }
        finishLogin(token, userData);
      } else {
        setError(res.data?.message || 'Login failed.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP: Send ──────────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!otpEmail.trim()) return setError('Enter your email first.');
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { email: otpEmail.toLowerCase().trim() });
      setOtpSent(true);
      setOtpStep('verify');
      startCountdown();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send OTP. Check your email.');
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP: Verify ────────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) return setError('Enter all 6 digits.');
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: otpEmail.toLowerCase().trim(),
        otp: code,
      });

      const token = res.data.data?.accessToken || res.data.token || res.data.accessToken;
      const user = res.data.data?.user || res.data.data;

      if (!res.data?.success || !token) {
        setError(res.data?.message || 'OTP verification failed.');
        setLoading(false);
        return;
      }

      const adminRoles = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
      if (!adminRoles.includes(user?.role)) {
        setError(`Access Denied: ${user?.email ? `"${user.email}"` : 'This email'} is not registered as an Admin. Contact your Super Admin.`);
        setLoading(false);
        return;
      }
      finishLogin(token, user);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, i: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    if (val.length > 1) {
      // paste
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const filled = [...Array(6)].map((_, idx) => digits[idx] || '');
      setOtp(filled);
      return;
    }
    next[i] = val;
    setOtp(next);
    if (val && i < 5) {
      (document.getElementById(`otp-${i + 1}`) as HTMLInputElement)?.focus();
    }
  };

  const handleGoogleIdToken = async (idToken: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', { idToken });
      const token = res.data.data?.accessToken || res.data.token || res.data.accessToken;
      const user = res.data.data?.user || res.data.data;
      if (res.data?.success && token) {
        const adminRoles = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
        if (!adminRoles.includes(user?.role)) {
          setError(`Access Denied: ${user?.email ? `"${user.email}"` : 'This email'} is not registered as an Admin. Contact your Super Admin.`);
          setLoading(false);
          return;
        }
        finishLogin(token, user);
      } else {
        setError(res.data?.message || 'Google login failed.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAccessToken = async (accessToken: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', { accessToken });
      const token = res.data.data?.accessToken || res.data.token || res.data.accessToken;
      const user = res.data.data?.user || res.data.data;
      if (res.data?.success && token) {
        const adminRoles = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
        if (!adminRoles.includes(user?.role)) {
          setError(`Access Denied: ${user?.email ? `"${user.email}"` : 'This email'} is not registered as an Admin. Contact your Super Admin.`);
          setLoading(false);
          return;
        }
        finishLogin(token, user);
      } else {
        setError(res.data?.message || 'Google login failed.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectGoogleRedirect = () => {
    const clientId = '400989529051-9r050me1vuquck9bqk30b6pd1i97k817.apps.googleusercontent.com';
    // Use origin directly (https://legalitt.vercel.app) to match Google Console Authorized redirect URIs
    const redirectUri = window.location.origin;
    const scope = 'openid email profile';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
    window.location.href = url;
  };

  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        window.history.replaceState(null, '', window.location.pathname);
        setMode('google');
        handleGoogleAccessToken(accessToken);
      }
    }
  }, []);

  // ─── Google OAuth ────────────────────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      handleGoogleAccessToken(tokenResponse.access_token);
    },
    onError: () => {
      handleDirectGoogleRedirect();
    },
    flow: 'implicit',
  });

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-[#111111]/80 backdrop-blur-2xl border border-white/10 shadow-2xl z-10"
      >
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 mb-6 relative flex justify-center">
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full" />
            <img src="/logo.png" alt="Legalitt" className="w-full h-full object-contain relative z-10 drop-shadow-2xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
          <p className="text-slate-400 text-sm text-center mt-1">Secure access for authorized administrators</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex bg-[#1A1A1A] rounded-2xl p-1 mb-6 gap-1">
          {([
            { key: 'password', label: '🔑 Password' },
            { key: 'otp',      label: '📱 OTP' },
            { key: 'google',   label: '🌐 Google' },
          ] as { key: LoginMode; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key); setError(''); setOtpStep('email'); setOtp(['','','','','','']); setLoading(false); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === tab.key ? 'bg-amber-500 text-[#0A0A0A] shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PASSWORD MODE ── */}
        <AnimatePresence mode="wait">
          {mode === 'password' && (
            <motion.form
              key="password"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handlePasswordLogin}
              className="space-y-4"
            >
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="Admin Email" autoComplete="email"
                  className="w-full pl-11 pr-4 h-13 py-3.5 bg-[#1A1A1A] border border-white/10 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Password" autoComplete="current-password"
                  className="w-full pl-11 pr-12 h-13 py-3.5 bg-[#1A1A1A] border border-white/10 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all"
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">Forgot Password?</button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-12 mt-2 bg-amber-500 hover:bg-amber-400 text-[#0A0A0A] rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {loading ? 'Signing in...' : 'Sign in to Admin Portal'}
              </button>
            </motion.form>
          )}

          {/* ── OTP MODE ── */}
          {mode === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              {otpStep === 'email' ? (
                <>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                    <input
                      type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                      placeholder="Your registered email" autoComplete="email"
                      className="w-full pl-11 pr-4 py-3.5 bg-[#1A1A1A] border border-white/10 text-white placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm transition-all"
                      onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                    />
                  </div>
                  <button onClick={handleSendOTP} disabled={loading || !otpEmail.trim()}
                    className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-[#0A0A0A] rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {loading ? 'Sending OTP...' : 'Send OTP to Email'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setOtpStep('email'); setOtp(['','','','','','']); setError(''); }} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <p className="text-slate-300 text-sm text-center">Enter the 6-digit OTP sent to</p>
                  <p className="text-amber-400 font-semibold text-sm text-center">{otpEmail}</p>

                  <div className="flex gap-2 justify-center my-4">
                    {otp.map((digit, i) => (
                      <input
                        key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={6}
                        value={digit} onChange={e => handleOtpChange(e.target.value, i)}
                        onKeyDown={e => { if (e.key === 'Backspace' && !digit && i > 0) { (document.getElementById(`otp-${i - 1}`) as HTMLInputElement)?.focus(); } }}
                        className="w-11 h-12 text-center text-lg font-bold bg-[#1A1A1A] border border-white/10 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                      />
                    ))}
                  </div>

                  <button onClick={handleVerifyOTP} disabled={loading || otp.join('').length !== 6}
                    className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-[#0A0A0A] rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>

                  <button onClick={countdown === 0 ? handleSendOTP : undefined} disabled={countdown > 0}
                    className="w-full text-center text-sm text-slate-400 hover:text-amber-400 disabled:text-slate-600 transition-colors pt-1">
                    {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* ── GOOGLE MODE ── */}
          {mode === 'google' && (
            <motion.div
              key="google"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-5"
            >
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-300 text-sm text-center">
                Sign in with your Google account registered as an admin.
              </div>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  handleDirectGoogleRedirect();
                }}
                disabled={loading}
                className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                <span>{loading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
              </button>

              <p className="text-center text-xs text-slate-500 leading-relaxed">
                Only admin accounts registered by a Super Admin can access this portal via Google.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-center text-xs text-slate-600 font-medium tracking-widest uppercase">
            Legalitt Enterprise Admin System
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
