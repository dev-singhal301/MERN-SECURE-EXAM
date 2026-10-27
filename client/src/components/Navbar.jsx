import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Completely unmount Navbar during active exams so logout is inaccessible
  if (location.pathname.startsWith('/exam/')) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-zinc-200 px-6 py-3 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-zinc-900 group">
          <div className="w-9 h-9 rounded-lg bg-teal-800 text-teal-300 flex items-center justify-center transition-all group-hover:bg-teal-900 shadow-inner">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base leading-tight font-extrabold text-zinc-900">SecureExam</span>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-teal-700">Proctored Assessment</span>
          </div>
        </Link>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-3">
          {profile && (
            <>
              <div className="flex items-center gap-2 bg-zinc-100/80 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>{profile.full_name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                <span className="capitalize font-semibold text-teal-800">{profile.role}</span>
              </div>

              {profile.role === 'admin' && (
                <Link
                  to="/admin"
                  className="text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 px-3.5 py-2 rounded-lg transition shadow-xs"
                >
                  Admin Console
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}