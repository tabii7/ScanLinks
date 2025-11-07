import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ModernLogin from './pages/ModernLogin';
import ModernAdminDashboard from './pages/admin/ModernAdminDashboard';
import ModernClientDashboard from './pages/client/ModernClientDashboard';
import RankTrackingPage from './pages/client/RankTrackingPage';
import ModernClientManagement from './pages/admin/ModernClientManagement';
import ClientCreationWizard from './pages/admin/ClientCreationWizard';
import ScanManagement from './pages/admin/ScanManagement';
import ScanConfiguration from './pages/admin/ScanConfiguration';
import ScanResultsPage from './pages/admin/ScanResultsPage';
import ComprehensiveScanResults from './pages/admin/ComprehensiveScanResults';
import ModernReportManagement from './pages/admin/ModernReportManagement';
import ClientReports from './pages/client/ClientReports';
import ClientScansIndex from './pages/client/ClientScansIndex';
import ClientScanResults from './pages/client/ClientScanResults';
import LoadingSpinner from './components/LoadingSpinner';
import ModernLayout from './components/ModernLayout';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Main App Component
const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <ModernLogin /> : <Navigate to="/" replace />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <ModernLayout isAdmin={true}>
            <ModernAdminDashboard />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
          <Route path="/admin/clients" element={
            <ProtectedRoute requiredRole="admin">
              <ModernLayout isAdmin={true}>
                <ModernClientManagement />
              </ModernLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/admin/clients/create" element={
            <ProtectedRoute requiredRole="admin">
              <ModernLayout isAdmin={true}>
                <ClientCreationWizard />
              </ModernLayout>
            </ProtectedRoute>
          } />
      
      <Route path="/admin/scans" element={
        <ProtectedRoute requiredRole="admin">
          <ModernLayout isAdmin={true}>
            <ScanManagement />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/scan-configuration" element={
        <ProtectedRoute requiredRole="admin">
          <ModernLayout isAdmin={true}>
            <ScanConfiguration />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/scans/:scanId" element={
        <ProtectedRoute requiredRole="admin">
          <ScanResultsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/reports" element={
        <ProtectedRoute requiredRole="admin">
          <ModernLayout isAdmin={true}>
            <ModernReportManagement />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
      
      
      <Route path="/admin/reports/:clientId" element={
        <ProtectedRoute requiredRole="admin">
          <ComprehensiveScanResults />
        </ProtectedRoute>
      } />
      

      {/* Client Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'admin' ? <Navigate to="/admin" replace /> : 
            <ModernLayout isAdmin={false}>
              <ModernClientDashboard />
            </ModernLayout>
          }
        </ProtectedRoute>
      } />
      
      <Route path="/reports" element={
        <ProtectedRoute requiredRole="client">
          <ModernLayout isAdmin={false}>
            <ClientReports />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/rank-tracking" element={
        <ProtectedRoute requiredRole="client">
          <ModernLayout isAdmin={false}>
            <RankTrackingPage />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/scans" element={
        <ProtectedRoute requiredRole="client">
          <ModernLayout isAdmin={false}>
            <ClientScansIndex />
          </ModernLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/scans/:scanId" element={
        <ProtectedRoute requiredRole="client">
          <ModernLayout isAdmin={false}>
            <ClientScanResults />
          </ModernLayout>
        </ProtectedRoute>
      } />


      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App
function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="App">
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
