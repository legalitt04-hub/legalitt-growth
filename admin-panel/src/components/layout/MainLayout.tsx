import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import api from '../../lib/api';

const MainLayout = () => {
  const { isAuthenticated, isLoading, canAccess } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [branding, setBranding] = useState({ primaryColor: '#f59e0b', logoUrl: '/logo.png', faviconUrl: '/logo.png' });

  useEffect(() => {
    const applyBranding = (value: any) => {
      if (!value) return;
      setBranding((current) => ({ ...current, ...value }));
      if (value.primaryColor) document.documentElement.style.setProperty('--brand-color', value.primaryColor);
      if (value.faviconUrl) {
        let icon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
        icon.href = value.faviconUrl;
      }
    };
    api.get('/settings').then(response => applyBranding(response.data?.data?.branding)).catch(() => {});
    const listener = (event: Event) => applyBranding((event as CustomEvent).detail);
    window.addEventListener('legalitt-branding-updated', listener);
    return () => window.removeEventListener('legalitt-branding-updated', listener);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle body scroll lock for modals
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isMobileMenuOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(location.pathname)) {
    return <Navigate to="/" replace />;
  }


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex relative overflow-hidden">
      {/* Subtle grid pattern background for light theme */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMikiLz48L3N2Zz4=')] opacity-60 pointer-events-none" />
      
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        setIsOpen={setIsMobileMenuOpen} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        branding={branding}
      />
      
      <div 
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 w-full",
          isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} isSidebarCollapsed={isSidebarCollapsed} />
        
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden w-full">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
