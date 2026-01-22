import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Financials from './pages/Financials';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import { LayoutDashboard, Building2, Users, Wallet, Home, Wrench, Settings, FileText, PieChart } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Buildings from './pages/Buildings';
import Units from './pages/Units';
import Tenants from './pages/Tenants';
import Leases from './pages/Leases';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import { Navigate } from 'react-router-dom';

import AdminSettings from './pages/AdminSettings';

function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { logout, user } = useAuth(); // Access logout here

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/buildings', icon: Building2, label: t('buildings') },
    { path: '/units', icon: Home, label: t('units') },
    { path: '/leases', icon: FileText, label: 'Leases' },
    { path: '/tenants', icon: Users, label: t('tenants') },
    { path: '/financials', icon: Wallet, label: t('financials') },
    { path: '/maintenance', icon: Wrench, label: t('maintenance') },
  ];

  if (user?.role === 'owner') {
    navItems.push({ path: '/reports', icon: PieChart, label: 'Reports' });
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

  return (
    <div className="app-shell">
      <header className="header-main">
        <div className="brand-logo">
          <Building2 size={24} className="text-primary" />
          <span>PropertyMgr</span>
        </div>

        <div className="user-profile">
          <span className="username">{user?.username}</span>
          <button
            onClick={logout}
            className="btn btn-sm btn-ghost"
            title="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      <nav className="nav-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/buildings" element={<Buildings />} />
                <Route path="/units" element={<Units />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/financials" element={<Financials />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/admin" element={<AdminSettings />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
