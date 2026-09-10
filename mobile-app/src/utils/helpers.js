/**
 * Legalitt utility functions
 */

// ─── Date & Time ──────────────────────────────────────────────────────────────

export const formatDate = (date, format = 'short') => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';

  if (format === 'short') {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (format === 'time') {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (format === 'full') {
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
  if (format === 'relative') {
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(date, 'short');
  }
  return d.toLocaleDateString('en-IN');
};

export const formatCountdown = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── Currency ─────────────────────────────────────────────────────────────────

export const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
};

export const formatINRShort = (amount) => {
  const n = Number(amount) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

// ─── Validators ───────────────────────────────────────────────────────────────

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase().trim());

export const isValidPhone = (phone) =>
  /^(\+91|91)?[6-9]\d{9}$/.test(String(phone).replace(/\s/g, ''));

export const isValidPassword = (password) =>
  password && password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[0-9]/.test(password);

export const passwordStrength = (password) => {
  if (!password) return { score: 0, label: 'Enter password' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'];
  return { score, label: labels[score - 1] || 'Very Weak', color: colors[score - 1] || '#ef4444' };
};

// ─── String helpers ───────────────────────────────────────────────────────────

export const getInitials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

export const truncate = (str, length = 80) =>
  str && str.length > length ? str.slice(0, length).trim() + '…' : str;

export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

export const slugify = (str) =>
  str?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || '';

// ─── Status helpers ───────────────────────────────────────────────────────────

export const BOOKING_STATUS_CONFIG = {
  pending:     { label: 'Pending',     bg: '#fef9c3', text: '#854d0e', icon: 'time-outline' },
  confirmed:   { label: 'Confirmed',   bg: '#dcfce7', text: '#166534', icon: 'checkmark-circle-outline' },
  completed:   { label: 'Completed',   bg: '#dbeafe', text: '#1e40af', icon: 'checkbox-outline' },
  cancelled:   { label: 'Cancelled',   bg: '#fee2e2', text: '#991b1b', icon: 'close-circle-outline' },
  rescheduled: { label: 'Rescheduled', bg: '#ede9fe', text: '#5b21b6', icon: 'refresh-outline' },
  no_show:     { label: 'No Show',     bg: '#f3f4f6', text: '#374151', icon: 'alert-circle-outline' },
};

export const getBookingStatusConfig = (status) =>
  BOOKING_STATUS_CONFIG[status] || BOOKING_STATUS_CONFIG.pending;

// ─── File helpers ─────────────────────────────────────────────────────────────

export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const getFileIcon = (mimeType = '') => {
  if (mimeType.includes('pdf')) return 'document-text';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('word')) return 'document';
  return 'attach';
};

// ─── Rating helpers ───────────────────────────────────────────────────────────

export const renderStars = (rating, max = 5) =>
  Array.from({ length: max }, (_, i) => ({
    filled: i < Math.floor(rating),
    half: i === Math.floor(rating) && rating % 1 >= 0.5,
  }));

// ─── Error helpers ────────────────────────────────────────────────────────────

export const parseApiError = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return 'Something went wrong. Please try again.';
};

// ─── Indian phone formatter ───────────────────────────────────────────────────

export const formatIndianPhone = (phone) => {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};
