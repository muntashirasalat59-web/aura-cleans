import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import Layout from './components/Layout';
import DataSyncProvider from './components/DataSyncProvider';
import LoadingState from './components/LoadingState';
import { BusinessSettingsProvider } from './context/BusinessSettingsContext';

/** Auth screens stay eager — small + first paint. Heavy app pages are code-split. */
import Login from './pages/Login';
import Signup from './pages/Signup';
import CheckEmail from './pages/CheckEmail';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Parties = lazy(() => import('./pages/Parties'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Sales = lazy(() => import('./pages/Sales'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Employees = lazy(() => import('./pages/Employees'));
const Reports = lazy(() => import('./pages/Reports'));
const PricingCalculator = lazy(() => import('./pages/PricingCalculator'));
const Users = lazy(() => import('./pages/Users'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const BusinessSettings = lazy(() => import('./pages/BusinessSettings'));

function RouteFallback() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingState message={pathname === '/' ? 'Loading dashboard…' : 'Loading page…'} />
    </div>
  );
}

function AppRoutes() {
  return (
    <DataSyncProvider>
      <BusinessSettingsProvider>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </BusinessSettingsProvider>
    </DataSyncProvider>
  );
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <GuestRoute>
                    <Signup />
                  </GuestRoute>
                }
              />
              <Route
                path="/check-email"
                element={
                  <GuestRoute>
                    <CheckEmail />
                  </GuestRoute>
                }
              />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route element={<AppRoutes />}>
                  <Route index element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="parties" element={<Parties />} />
                  <Route path="purchases" element={<Purchases />} />
                  <Route path="sales" element={<Sales />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="pricing-calculator" element={<PricingCalculator />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="users" element={<Users />} />
                  <Route path="activity-log" element={<ActivityLog />} />
                  <Route path="settings/business" element={<BusinessSettings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
