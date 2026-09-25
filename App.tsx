import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './src/styles.css';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { ProtectedRoute } from './src/components/ProtectedRoute';
import { HomePage } from './src/pages/HomePage';
import { LoginPage } from './src/pages/LoginPage';

const RegisterPage = lazy(() => import('./src/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const InvoicePage = lazy(() => import('./src/pages/InvoicePage').then((m) => ({ default: m.InvoicePage })));
const ImportPage = lazy(() => import('./src/pages/ImportPage').then((m) => ({ default: m.ImportPage })));
const DataPage = lazy(() => import('./src/pages/DataPage').then((m) => ({ default: m.DataPage })));
const SearchPage = lazy(() => import('./src/pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const ProfilePage = lazy(() => import('./src/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));

function RouteFallback() {
  return <div className="panel muted" style={{ margin: 18 }}>Duke ngarkuar…</div>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/register"
              element={
                <ProtectedRoute>
                  <RegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fature"
              element={
                <ProtectedRoute>
                  <InvoicePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <ImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data"
              element={
                <ProtectedRoute>
                  <DataPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
