import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { initSocket, disconnectSocket } from './services/socketService';

export default function Layout() {
  const [isDarkMode, setDarkMode] = useState(false);
  const location = useLocation();

  // Initialize socket connection when Layout mounts (user is authenticated)
  // This ensures notifications work on ALL pages, not just ChatPage
  useEffect(() => {
    console.log('[Layout] Initializing Socket for real-time notifications...');
    const socket = initSocket();

    return () => {
      // Only disconnect when Layout unmounts (user logs out)
      // Note: We don't disconnect here to keep socket alive across page navigations
    };
  }, []);

  // Determine active page based on route
  const getActivePage = () => {
    if (location.pathname === '/dashboard') return 'dashboard';
    if (location.pathname === '/my-tasks') return 'my-tasks';
    if (location.pathname.includes('/chat')) return 'chat';
    if (location.pathname.includes('/project')) return 'projects';
    if (location.pathname.startsWith('/admin')) return 'admin';
    return '';
  };

  // Dynamic classes based on theme
  const bgMain = isDarkMode ? 'bg-dark-primary' : 'bg-white';
  const textMain = isDarkMode ? 'text-gray-300' : 'text-gray-900';

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-500/30 transition-colors duration-300 ${bgMain} ${textMain}`}>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header - Full Width */}
        <Header 
          isDarkMode={isDarkMode} 
          toggleDarkMode={() => setDarkMode(!isDarkMode)}
        />

        {/* Sidebar + Main Content */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar 
            darkMode={isDarkMode} 
            activePage={getActivePage()} 
          />

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <Outlet context={{ isDarkMode }} />
          </main>
        </div>
      </div>
    </div>
  );
}
