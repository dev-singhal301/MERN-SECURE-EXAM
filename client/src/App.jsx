import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import CreateExam from './pages/CreateExam';
import EditExam from './pages/EditExam';
import ExamScreen from './pages/ExamScreen';
import ResultScreen from './pages/ResultScreen';
import AdminDashboard from './pages/AdminDashboard';
import AdminSubmissions from './pages/AdminSubmissions';
import AdminLeaderboard from './pages/AdminLeaderboard';

function ProtectedRoute({ children, roleRequired }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Authenticating...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roleRequired && profile?.role !== roleRequired) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
          <Navbar />
          <div className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Student Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exam/:id"
                element={
                  <ProtectedRoute>
                    <ExamScreen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/result/:id"
                element={
                  <ProtectedRoute>
                    <ResultScreen />
                  </ProtectedRoute>
                }
              />

              {/* Admin Console Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/create"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <CreateExam />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/edit/:examId"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <EditExam />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/submissions/:examId"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminSubmissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/leaderboard/:examId"
                element={
                  <ProtectedRoute roleRequired="admin">
                    <AdminLeaderboard />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}