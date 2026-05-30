import { useState } from 'react';
import { LayoutDashboard, FolderKanban, Users, Settings, MessageSquare, Zap, Folder, CheckSquare, ChevronDown, Shield } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUserTeams } from '../services/projectApi';
import { useAuth } from '../hooks/useAuth';
import SidebarItem from './SidebarItem';

// Maximum teams to display in sidebar before showing "See more"
const MAX_VISIBLE_TEAMS = 4;

export default function Sidebar({ darkMode, activePage }) {
  const bgSidebar = darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200 shadow-sm';
  const { teamId } = useParams();
  const { isAdmin } = useAuth();

  // Fetch user's teams
  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['userTeams'],
    queryFn: getUserTeams,
  });

  const teams = teamsData?.data || [];
  const [isTeamsExpanded, setIsTeamsExpanded] = useState(false);
  
  const visibleTeams = isTeamsExpanded ? teams : teams.slice(0, MAX_VISIBLE_TEAMS);
  const hasMoreTeams = teams.length > MAX_VISIBLE_TEAMS;
  const hiddenTeamsCount = teams.length - MAX_VISIBLE_TEAMS;
  
  // Determine which team to use for chat link
  // Priority: current teamId from route > first team from list > no team route
  const chatTeamId = teamId || (teams.length > 0 ? teams[0].id : null);
  const chatLink = chatTeamId ? `/teams/${chatTeamId}/chat` : '/chat';

  // Custom scrollbar class based on theme
  const scrollbarClass = darkMode ? 'custom-scrollbar-dark' : 'custom-scrollbar';

  return (
    <aside 
      className={`w-16 hover:w-56 group ${bgSidebar} border-r flex flex-col transition-all duration-300 overflow-hidden`}
    >
      {/* Navigation */}
      <nav className={`flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden ${scrollbarClass}`}>
        <Link to="/dashboard" className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group/item relative ${
          activePage === 'dashboard'
            ? darkMode
              ? 'bg-[#171717] text-white' 
              : 'bg-gray-200 text-gray-900'
            : `${darkMode ? 'text-gray-400 hover:bg-[#1F1F1F] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
        }`}>
          <LayoutDashboard size={20} className="flex-shrink-0" />
          <span className="ml-3 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">Dashboard</span>
        </Link>
        <Link to="/my-tasks" className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group/item relative ${
          activePage === 'my-tasks'
            ? darkMode
              ? 'bg-[#171717] text-white' 
              : 'bg-gray-200 text-gray-900'
            : `${darkMode ? 'text-gray-400 hover:bg-[#1F1F1F] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
        }`}>
          <CheckSquare size={20} className="flex-shrink-0" />
          <span className="ml-3 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">My Tasks</span>
        </Link>
        <Link to={chatLink} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group/item relative ${
          activePage === 'chat'
            ? darkMode
              ? 'bg-[#171717] text-white' 
              : 'bg-gray-200 text-gray-900'
            : `${darkMode ? 'text-gray-400 hover:bg-[#1F1F1F] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
        }`}>
          <MessageSquare size={20} className="flex-shrink-0" />
          <span className="ml-3 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">Team Chat</span>
          <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">3</span>
        </Link>
        {/* <SidebarItem icon={FolderKanban} label="Projects" active={activePage === 'projects'} darkMode={darkMode} />
        <SidebarItem icon={Users} label="Team Members" darkMode={darkMode} />
        <SidebarItem icon={Settings} label="Settings" darkMode={darkMode} /> */}

        {/* Admin Portal Link - only visible to system admins */}
        {isAdmin && (
          <Link to="/admin" className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group/item relative ${
            activePage === 'admin'
              ? darkMode
                ? 'bg-[#171717] text-white' 
                : 'bg-gray-200 text-gray-900'
              : `${darkMode ? 'text-gray-400 hover:bg-[#1F1F1F] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
          }`}>
            <Shield size={20} className="flex-shrink-0 text-amber-500" />
            <span className="ml-3 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">Admin Portal</span>
          </Link>
        )}

        {/* Divider */}
        <div className={`my-4 mx-4 border-t transition-colors duration-300 ${darkMode ? 'border-[#171717]' : 'border-gray-200'}`}></div>

        {/* My Teams */}
        <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          My Teams
        </div>
        
        {teamsLoading ? (
          <div className="px-4 py-2">
            <div className={`animate-pulse h-8 rounded ${darkMode ? 'bg-[#1F1F1F]' : 'bg-gray-200'}`}></div>
          </div>
        ) : teams.length === 0 ? (
          <div className={`px-4 py-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No teams found
          </div>
        ) : (
          <>
            {visibleTeams.map((team) => (
              <Link 
                key={team.id} 
                to={`/teams/${team.id}`}
                className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all ${
                  teamId === String(team.id)
                    ? darkMode 
                      ? 'bg-[#171717] text-white' 
                      : 'bg-gray-200 text-gray-900'
                    : darkMode 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-[#1F1F1F]' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={team.name}
              >
                <Folder size={18} className={`flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <span className="ml-3 flex-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">{team.name}</span>
                {team.project_count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${
                    teamId === String(team.id)
                      ? 'bg-white/20'
                      : darkMode
                        ? 'bg-[#171717]'
                        : 'bg-gray-200'
                  }`}>
                    {team.project_count}
                  </span>
                )}
              </Link>
            ))}
            
            {/* Expand/Collapse Ghost Button - Gemini style */}
            {hasMoreTeams && (
              <button 
                onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
                className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                  darkMode 
                    ? 'text-gray-600 hover:text-gray-400 hover:bg-[#1F1F1F]/50' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/70'
                }`}
                title={isTeamsExpanded ? 'Show less' : `Show ${hiddenTeamsCount} more teams`}
              >
                <ChevronDown 
                  size={16} 
                  className={`flex-shrink-0 transition-transform duration-200 ${
                    isTeamsExpanded ? 'rotate-180' : ''
                  }`} 
                />
                <span className="ml-3 flex-1 text-left opacity-0 group-hover:opacity-100 transition-opacity">
                  {isTeamsExpanded ? 'Show less' : <><span className="font-semibold">{hiddenTeamsCount}</span> more</>}
                </span>
              </button>
            )}
          </>
        )}
      </nav>

      {/* <div className={`px-3 pt-2 pb-3 border-t transition-colors duration-300 ${darkMode ? 'border-[#171717]' : 'border-gray-200'}`}>
        <button 
          className={`w-full flex items-center px-3 py-3 rounded-lg transition-all ${darkMode ? 'hover:bg-[#1F1F1F] text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          title="Upgrade Plan"
        >
          <Zap size={20} className="text-amber-500 flex-shrink-0" />
          <span className={`ml-3 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Upgrade Plan
          </span>
        </button>
      </div> */}
    </aside>
  );
}
