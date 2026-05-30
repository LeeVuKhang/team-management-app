import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './LandingPage.jsx';
import Login from './Login.jsx';
import Signup from './Signup.jsx';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import TeamPage from './TeamPage.jsx';
import ProjectPage from './ProjectPage.jsx';
import AcceptInvitePage from './AcceptInvitePage.jsx';
import ChatPage from './ChatPage.jsx';
import MyTasksPage from './MyTasksPage.jsx';
import ProfileSetting from './ProfileSetting.jsx';
import HelpSupport from './HelpSupport.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminLayout from './AdminLayout.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminUsersPage from './AdminUsersPage.jsx';
import AdminAuditLogsPage from './AdminAuditLogsPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            marginTop: '60px',
          },
          success: {
            iconTheme: {
              primary: '#308f68',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/profile" element={<ProfileSetting />} />
          <Route path="/settings" element={<ProfileSetting />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/teams/:teamId/chat" element={<ChatPage />} />
          <Route path="/teams/:teamId" element={<TeamPage />} />
          <Route path="/teams/:teamId/projects/:projectId" element={<ProjectPage />} />
          <Route path="/help" element={<HelpSupport />} />
        </Route>
        {/* Admin Portal - Protected by AdminRoute guard */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App

