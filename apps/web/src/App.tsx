import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { LoginPage, homeFor } from './pages/LoginPage';
import { GuardDeskPage } from './pages/GuardDeskPage';
import { ResidentPage } from './pages/ResidentPage';
import { AdminPage } from './pages/AdminPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';

// Route Guard component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7F6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '4px solid #0B5D5B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 11, color: '#5E7371', fontWeight: 700, letterSpacing: '0.1em' }}>LOADING PARCELO...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A temporary password must be replaced before anything else (the API enforces it too)
  if (user.mustChangePassword && location.pathname !== '/password') {
    return <Navigate to="/password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F7F6', color: '#10302F' }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
};

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    // Signed-out visitors see the intro page first (a static page in public/welcome); it links to /login
    window.location.replace('/welcome/');
    return null;
  }

  return <Navigate to={homeFor(user)} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/guard"
              element={
                <ProtectedRoute allowedRoles={['GUARD', 'ADMIN']}>
                  <GuardDeskPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resident"
              element={
                <ProtectedRoute allowedRoles={['RESIDENT', 'ADMIN']}>
                  <ResidentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
