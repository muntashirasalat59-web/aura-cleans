import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

import Layout from './components/Layout';
import DataSyncProvider from './components/DataSyncProvider';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';

import Products from './pages/Products';

import Parties from './pages/Parties';

import Purchases from './pages/Purchases';

import Sales from './pages/Sales';

import Expenses from './pages/Expenses';

import Employees from './pages/Employees';

import Reports from './pages/Reports';
import PricingCalculator from './pages/PricingCalculator';

import Users from './pages/Users';
import ActivityLog from './pages/ActivityLog';
import BusinessSettings from './pages/BusinessSettings';
import { BusinessSettingsProvider } from './context/BusinessSettingsContext';

function AppRoutes() {
  return (
    <DataSyncProvider>
      <BusinessSettingsProvider>
        <Outlet />
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
