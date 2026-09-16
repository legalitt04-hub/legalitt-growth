import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import MainLayout from './components/layout/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Users from './pages/Users';
import Advocates from './pages/Advocates';
import Verification from './pages/Verification';
import Earnings from './pages/Earnings';
import Settings from './pages/Settings';

// Phase 3 & Production 17-Module Pages
import Cases from './pages/Cases';
import Services from './pages/Services';
import AIDrafts from './pages/AIDrafts';
import Documents from './pages/Documents';
import Support from './pages/Support';
import Reports from './pages/Reports';
import CalendarView from './pages/CalendarView';
import Notifications from './pages/Notifications';
import Consultations from './pages/Consultations';
import ChatManagement from './pages/ChatManagement';
import Categories from './pages/Categories';
import Reviews from './pages/Reviews';
import Coupons from './pages/Coupons';
import Admins from './pages/Admins';
import AuditLogs from './pages/AuditLogs';
import PendingAdvocates from './pages/PendingAdvocates';
import Withdrawals from './pages/Withdrawals';
import AdsManagement from './pages/AdsManagement';
import RoleManagement from './pages/RoleManagement';
// Phase 4 — Financial Reporting
import PaymentHistory from './pages/PaymentHistory';
import Transactions from './pages/Transactions';
import FIRDrafts from './pages/FIRDrafts';
import PropertyResearch from './pages/PropertyResearch';
import DocumentForensic from './pages/DocumentForensic';
import LegalNotices from './pages/LegalNotices';
import ErrorBoundary from './components/ErrorBoundary';
import CallHistory from './pages/CallHistory';
import PricingSettings from './pages/PricingSettings';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Protected Routes Wrapper */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            
            {/* Consultations & Ops */}
            <Route path="/consultations" element={<Consultations />} />
            <Route path="/chats" element={<ChatManagement />} />
            <Route path="/call-history" element={<CallHistory />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/services" element={<Services />} />
            <Route path="/ai-drafts" element={<AIDrafts />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/fir-drafts" element={<FIRDrafts />} />
            <Route path="/legal-notices" element={<LegalNotices />} />
            <Route path="/property-research" element={<PropertyResearch />} />
            <Route path="/document-forensic" element={<DocumentForensic />} />
            
            {/* Network & Team */}
            <Route path="/users" element={<Users />} />
            <Route path="/advocates" element={<Advocates />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/admins" element={<Admins />} />
            
            {/* Financials */}
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/pending-advocates" element={<PendingAdvocates />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
            <Route path="/payment-history" element={<PaymentHistory />} />
            <Route path="/transactions" element={<Transactions />} />
            
            {/* Workspace & Desk */}
            <Route path="/support" element={<Support />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/notifications" element={<Notifications />} />
            
            {/* System & Intelligence */}
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/settings" element={<Settings />} />

            {/* New Modules */}
            <Route path="/ads" element={<AdsManagement />} />
            <Route path="/roles" element={<RoleManagement />} />
            <Route path="/pricing" element={<PricingSettings />} />
          </Route>
        </Routes>
        </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
