import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, FolderKanban, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import * as teamApi from './services/teamApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

/**
 * TEAM CARD COMPONENT
 */
const TeamCard = ({ team, darkMode, onClick }) => (
  <div 
    onClick={onClick}
    className={`${darkMode ? 'bg-dark-secondary border-[#308f68]' : 'bg-white border-gray-200 hover:border-gray-400'} 
      border rounded-xl p-3 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] group`}
  >
    {/* Team Name */}
    <div className="mb-4">
      <h3 className={`font-semibold text-lg mb-1 ${darkMode ? 'text-white' : 'text-black'}`}>
        {team.name}
      </h3>
      {team.description && (
        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {team.description}
        </p>
      )}
    </div>

    {/* Stats */}
    <div className="flex gap-4 mb-4">
      <div className="flex items-center gap-2">
        <FolderKanban size={16} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {team.project_count || 0} projects
        </span>
      </div>
    </div>

    {/* Role Badge */}
    <div className="flex items-center gap-2">
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        team.role === 'owner' 
          ? 'bg-[#308f68] text-white' 
          : team.role === 'admin'
          ? 'bg-blue-500 text-white'
          : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
      }`}>
        {team.role}
      </span>
    </div>
  </div>
);

/**
 * MAIN DASHBOARD COMPONENT
 */
export default function Dashboard() {
  const { isDarkMode } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [teams, setTeams] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isAllTeamsModalOpen, setIsAllTeamsModalOpen] = React.useState(false);
  const [newTeamData, setNewTeamData] = React.useState({
    name: '',
    description: ''
  });

  // Fetch teams from backend
  React.useEffect(() => {
    const fetchTeams = async () => {
      try {
        console.log('=== FRONTEND: Fetching teams ===');
        const response = await fetch(`${API_BASE_URL}/teams`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          throw new Error(errorData.message || 'Failed to fetch teams');
        }

        const data = await response.json();
        console.log('Received data:', data);
        console.log('Teams array:', data.data);
        console.log('Number of teams:', data.data?.length || 0);
        
        setTeams(data.data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
        toast.error('Failed to load teams');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Filter teams based on search
  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Limit to 7 teams for display, save the 8th slot for "+N" card
  const displayedTeams = filteredTeams.slice(0, 8);
  const remainingTeamsCount = filteredTeams.length - 8;

  const handleTeamClick = (teamId) => {
    navigate(`/teams/${teamId}`);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();

    if (!newTeamData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      const res = await teamApi.createTeam({
        name: newTeamData.name,
        description: newTeamData.description,
      });

      const created = res.data;

      const teamForUI = {
        id: created.id,
        name: created.name,
        description: created.description || '',
        role: 'owner',
        project_count: 0
      };

      setTeams(prev => [...prev, teamForUI]);

      // Invalidate sidebar teams cache to refresh "My Teams" list
      queryClient.invalidateQueries({ queryKey: ['userTeams'] });

      toast.success(`Team "${created.name}" created successfully!`);
      setIsModalOpen(false);
      setNewTeamData({ name: '', description: '' });
    } catch (err) {
      console.error('Failed to create team:', err);
      toast.error('Failed to create team. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewTeamData({ name: '', description: '' });
  };

  return (
    <div className="w-full min-h-full flex flex-col max-w-[1200px] mx-auto px-4 lg:px-6 xl:px-10">
      
      {/* Header Section */}
      <div className="pt-12 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Your Teams
            </h1>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold transition-all bg-[#006239] hover:bg-[#005230] text-white border border-[#308f68] shadow-lg active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} className="text-[#308f68]" />
            New team
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="py-6">
        <div className="relative w-full md:w-80">
          <Search 
            size={18} 
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} 
          />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-md border text-sm transition-colors
              ${isDarkMode 
                ? 'bg-dark-secondary border-[#171717] text-white placeholder-gray-500 focus:border-gray-700' 
                : 'bg-white border-gray-200 text-black placeholder-gray-400 focus:border-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          </div>
        ) : (
          <>
            {teams.length === 0 ? (
              <div className={`text-center py-20 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No teams yet</p>
                <p className="text-sm mb-4">Create your first team to get started</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-[#006239] hover:bg-[#005230] text-white transition-colors"
                >
                  Create Team
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {displayedTeams.map((team) => (
                    <TeamCard 
                      key={team.id} 
                      team={team} 
                      darkMode={isDarkMode}
                      onClick={() => handleTeamClick(team.id)}
                    />
                  ))}
                  
                  {remainingTeamsCount > 0 && (
                    <div 
                      onClick={() => setIsAllTeamsModalOpen(true)}
                      className={`${isDarkMode ? 'bg-dark-secondary border-[#171717] hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-400'} 
                        border rounded-xl p-3 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center min-h-[140px]`}
                    >
                      <div className="text-center">
                        <div className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                          +{remainingTeamsCount}
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          more {remainingTeamsCount === 1 ? 'team' : 'teams'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {filteredTeams.length === 0 && (
                  <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p>No teams found matching "{searchQuery}"</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* New Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseModal}
          ></div>
          
          {/* Modal */}
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${
            isDarkMode ? 'bg-dark-secondary' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDarkMode ? 'border-[#171717]' : 'border-gray-200'
            }`}>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Create New Team
              </h2>
              <button
                onClick={handleCloseModal}
                className={`p-1 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-[#171717] text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTeam} className="px-6 py-5 space-y-4">
              {/* Team Name */}
              <div>
                <label 
                  htmlFor="teamName" 
                  className={`block text-sm font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Team Name *
                </label>
                <input
                  type="text"
                  id="teamName"
                  value={newTeamData.name}
                  onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                  placeholder="e.g., Engineering Team"
                  className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-1 ${
                    isDarkMode
                      ? 'bg-dark-primary border-[#171717] text-white placeholder-gray-500 focus:ring-gray-700 focus:border-gray-700'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-gray-900 focus:border-transparent'
                  }`}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label 
                  htmlFor="teamDescription" 
                  className={`block text-sm font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Description <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="teamDescription"
                  value={newTeamData.description}
                  onChange={(e) => setNewTeamData({ ...newTeamData, description: e.target.value })}
                  placeholder="What's this team about?"
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-1 resize-none ${
                    isDarkMode
                      ? 'bg-dark-primary border-[#171717] text-white placeholder-gray-500 focus:ring-gray-700 focus:border-gray-700'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-gray-900 focus:border-transparent'
                  }`}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    isDarkMode
                      ? 'bg-dark-primary text-white hover:bg-[#171717]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all bg-[#006239] hover:bg-[#005230] text-white border border-[#308f68] shadow-lg active:scale-95"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All Teams Modal */}
      {isAllTeamsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsAllTeamsModalOpen(false)}
          ></div>
          
          {/* Modal */}
          <div className={`relative w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-dark-secondary' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDarkMode ? 'border-[#171717]' : 'border-gray-200'
            }`}>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                All Teams ({filteredTeams.length})
              </h2>
              <button
                onClick={() => setIsAllTeamsModalOpen(false)}
                className={`p-1 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-[#171717] text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Teams List */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
              <div className="space-y-3">
                {filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => {
                      setIsAllTeamsModalOpen(false);
                      handleTeamClick(team.id);
                    }}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${
                      isDarkMode 
                        ? 'bg-dark-primary border-[#308f68]' 
                        : 'bg-white border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className={`font-semibold text-base mb-1 ${
                          isDarkMode ? 'text-white' : 'text-black'
                        }`}>
                          {team.name}
                        </h3>
                        {team.description && (
                          <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {team.description}
                          </p>
                        )}
                        <div className="flex gap-4 text-sm items-center">
                          <div className="flex items-center gap-1.5">
                            <FolderKanban size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {team.project_count || 0} projects
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            team.role === 'owner' 
                              ? 'bg-[#308f68] text-white' 
                              : team.role === 'admin'
                              ? 'bg-blue-500 text-white'
                              : isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {team.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
