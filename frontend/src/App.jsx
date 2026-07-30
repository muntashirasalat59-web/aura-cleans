import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import { ThemeProvider } from './context/ThemeContext';

import ProtectedRoute from './components/ProtectedRoute';

import Layout from './components/Layout';

import Login from './pages/Login';

import Dashboard from './pages/Dashboard';

import Products from './pages/Products';

import Parties from './pages/Parties';

import Purchases from './pages/Purchases';

import Sales from './pages/Sales';

import Expenses from './pages/Expenses';

import Employees from './pages/Employees';

import Reports from './pages/Reports';

import Users from './pages/Users';



function AppShell() {

  return (

    <Layout>

      <Routes>

        <Route path="/" element={<Dashboard />} />

        <Route path="/products" element={<Products />} />

        <Route path="/parties" element={<Parties />} />

        <Route path="/purchases" element={<Purchases />} />

        <Route path="/sales" element={<Sales />} />

        <Route path="/expenses" element={<Expenses />} />

        <Route path="/reports" element={<Reports />} />

        <Route path="/employees" element={<Employees />} />

        <Route path="/users" element={<Users />} />

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

    </Layout>

  );

}



function App() {

  return (

    <BrowserRouter>

      <ThemeProvider>

        <AuthProvider>

          <Routes>

            <Route path="/login" element={<Login />} />

            <Route

              path="/*"

              element={

                <ProtectedRoute>

                  <AppShell />

                </ProtectedRoute>

              }

            />

          </Routes>

        </AuthProvider>

      </ThemeProvider>

    </BrowserRouter>

  );

}



export default App;


