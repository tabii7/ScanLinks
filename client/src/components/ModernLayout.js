import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  BarChart3,
  Bell,
  Clock,
  User,
  Settings,
  ChevronDown,
  Home,
  Search,
} from 'lucide-react';

const ModernLayout = ({ children, isAdmin = false }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminNavItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Clients', href: '/admin/clients', icon: Users },
    { name: 'New Scan', href: '/admin/scan-configuration', icon: Search },
    { name: 'Scans', href: '/admin/scans', icon: BarChart3 },
    { name: 'Reports', href: '/admin/reports', icon: FileText },
  ];

  const clientNavItems = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Scans', href: '/scans', icon: BarChart3 },
    { name: 'Reports', href: '/reports', icon: FileText },
  ];

  const navItems = isAdmin ? adminNavItems : clientNavItems;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex flex-col w-80 h-full shadow-2xl" style={{background: 'linear-gradient(to bottom, #030f30, #060b16)'}}>
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor: '#1e40af'}}>
                <Shield className="h-6 w-6" style={{color: '#d1d5db'}} />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{color: '#fafafa'}}>ACE REPUTATIONS</h1>
                <p className="text-xs" style={{color: '#e5e7eb'}}>ORM Platform</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          
          <nav className="flex-1 px-6 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'shadow-lg'
                      : 'hover:bg-gray-700'
                  }`}
                  style={isActive ? {backgroundColor: '#230D71', color: '#fafafa'} : {color: '#f3f4f6'}}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow shadow-xl" style={{background: 'linear-gradient(to bottom, #030f30, #060b16)'}}>
          <div className="flex items-center px-6 py-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{backgroundColor: '#1e40af'}}>
              <Shield className="h-7 w-7" style={{color: '#d1d5db'}} />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold" style={{color: '#fafafa'}}>ACE REPUTATIONS</h1>
              <p className="text-sm" style={{color: '#e5e7eb'}}>ORM Platform</p>
            </div>
          </div>
          
          <nav className="flex-1 px-6 py-8 space-y-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'shadow-lg transform scale-105'
                      : 'hover:bg-gray-700 hover:transform hover:scale-105'
                  }`}
                  style={isActive ? {backgroundColor: '#230D71', color: '#fafafa'} : {color: '#f3f4f6'}}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: '#1e40af'}}>
                <User className="h-5 w-5" style={{color: '#d1d5db'}} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{color: '#fafafa'}}>{user?.email}</p>
                <p className="text-xs capitalize" style={{color: '#e5e7eb'}}>{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72 flex flex-col flex-1">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex items-center justify-between h-16 px-6" style={{background: 'linear-gradient(to bottom, #030f30, #060b16)'}}>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Menu className="h-5 w-5 text-gray-300" />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-lg font-semibold" style={{color: '#fafafa'}}>
                {location.pathname === '/admin' && 'Dashboard'}
                {location.pathname === '/admin/clients' && 'Client Management'}
                {location.pathname === '/admin/keywords' && 'Keyword Management'}
                {location.pathname === '/admin/scans' && 'Scan Management'}
                {location.pathname === '/admin/reports' && 'Report Management'}
                {location.pathname === '/' && 'Dashboard'}
                {location.pathname === '/reports' && 'Reports'}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-lg hover:bg-gray-700 transition-colors relative">
              <Bell className="h-5 w-5 text-gray-300" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor: '#1e40af'}}>
                  <User className="h-4 w-4" style={{color: '#d1d5db'}} />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium" style={{color: '#f3f4f6'}}>{user?.email}</p>
                  <p className="text-xs capitalize" style={{color: '#d1d5db'}}>{user?.role}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-300" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-xl shadow-lg border border-gray-700 py-2 z-50">
                  <button className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

    {/* Page content */}
    <main className="flex-1 ar-theme" style={{backgroundColor: '#060b16'}}>
      <div className="p-6">
        {children}
      </div>
    </main>
      </div>
    </div>
  );
};

export default ModernLayout;
