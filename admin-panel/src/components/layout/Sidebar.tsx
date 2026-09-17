import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  CreditCard, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  LifeBuoy,
  BarChart3,
  MessageSquare,
  UserCog,
  Wallet,
  Megaphone,
  Shield,
  History,
  ReceiptText,
  FileText,
  Building,
  Microscope,
  Tag,
  IndianRupee,
  ScrollText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRole } from '../../contexts/RoleContext';
import { cn } from '../../lib/utils';

// Consolidated & Merged nav items
const navSections = [
  {
    title: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ]
  },
  {
    title: 'Consultations & Operations',
    items: [
      { icon: MessageSquare, label: 'Consultations & Chats', path: '/consultations' },
      { icon: Briefcase, label: 'Cases & Legal Notices', path: '/cases' },
      { icon: ScrollText, label: 'Legal Notices', path: '/legal-notices' },
      { icon: FileText, label: 'FIR Drafts', path: '/fir-drafts' },
      { icon: Building, label: 'Property Research', path: '/property-research' },
      { icon: Microscope, label: 'Document Forensic', path: '/document-forensic' },
    ]
  },
  {
    title: 'User & Advocate Network',
    items: [
      { icon: Users, label: 'Client Users', path: '/users' },
      { icon: UserCheck, label: 'Advocate Network & Approvals', path: '/advocates' },
      { icon: UserCog, label: 'Admin Team', path: '/admins' },
    ]
  },
  {
    title: 'Financials & Revenue',
    items: [
      { icon: CreditCard, label: 'Payments & Revenue',       path: '/earnings' },
      { icon: History,    label: 'Payment History',          path: '/payment-history' },
      { icon: ReceiptText,label: 'Transaction Ledger',       path: '/transactions' },
      { icon: Wallet,     label: 'Payouts & Withdrawals',    path: '/withdrawals' },
    ]
  },
  {
    title: 'Support & Growth',
    items: [
      { icon: LifeBuoy,  label: 'Support Desk & Tickets', path: '/support' },
      { icon: Tag,       label: 'Coupons & Offers',       path: '/coupons' },
      { icon: Megaphone, label: 'Ads & Promotions',       path: '/ads' },
    ]
  },
  {
    title: 'System & Security',
    items: [
      { icon: BarChart3, label: 'Reports & Analytics', path: '/reports' },
      { icon: Shield, label: 'Role Management', path: '/roles' },
      { icon: IndianRupee, label: 'Pricing Settings', path: '/pricing' },
      { icon: Settings, label: 'System Settings', path: '/settings' },
    ]
  }
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  branding?: { primaryColor?: string; logoUrl?: string };
}

const Sidebar = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed, branding }: SidebarProps) => {
  const { logout, user } = useAuth();
  const { canAccess, displayRole } = useRole();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter sections and items based on role
  const filteredNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => canAccess(item.path))
  })).filter(section => section.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside 
        className={cn(
          "fixed h-screen top-0 left-0 z-50 transition-all duration-300 ease-in-out lg:translate-x-0",
          isCollapsed ? "w-20" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "p-3"
        )}
      >
        <div className="h-full w-full bg-white border border-slate-200 rounded-2xl flex flex-col shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Logo + Collapse Toggle */}
          <div className="p-4 flex items-center justify-between shrink-0">
            <div className={cn("flex items-center gap-3", isCollapsed && "justify-center w-full")}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                <img src={branding?.logoUrl || '/logo.png'} alt="Legalitt" className="w-full h-full object-contain" />
              </div>
              {!isCollapsed && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xl font-bold text-slate-900 tracking-tight"
                >
                  Legal<span className="brand-text">itt</span>
                </motion.span>
              )}
            </div>
            {/* Collapse/Expand button — desktop only */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 px-3 py-2 overflow-y-auto sidebar-scroll space-y-4">
            {filteredNavSections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="space-y-1">
                {!isCollapsed && (
                  <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {section.title}
                  </h4>
                )}
                
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 rounded-xl transition-all duration-200 group relative",
                      isCollapsed ? "px-3 py-3 justify-center" : "px-3 py-2.5",
                      isActive 
                        ? "brand-nav-active font-semibold"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.div 
                            layoutId="activeTab" 
                            className="absolute left-0 top-0 w-1 h-full brand-bg rounded-r-full"
                          />
                        )}
                        <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "brand-text" : "group-hover:text-amber-500 transition-colors")} />
                        {!isCollapsed && (
                          <span className="text-sm">{item.label}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* User Profile / Logout */}
          <div className="p-3 mt-auto shrink-0">
            <div className={cn(
              "rounded-xl bg-slate-50 border border-slate-200",
              isCollapsed ? "p-2" : "p-3"
            )}>
              {!isCollapsed ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 text-slate-950 font-bold text-xs">
                      {user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'AD'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Admin'}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        user?.role === 'super_admin' ? 'bg-red-100 text-red-600' :
                        user?.role === 'admin' ? 'bg-indigo-100 text-indigo-600' :
                        user?.role === 'accounts' ? 'bg-emerald-100 text-emerald-600' :
                        user?.role === 'support_executive' ? 'bg-blue-100 text-blue-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>{displayRole}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 text-sm shadow-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Log out</span>
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
