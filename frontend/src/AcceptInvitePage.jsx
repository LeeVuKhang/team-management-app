import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { acceptInvitation, declineInvitation, getInvitationPreview } from './services/notificationApi';
import { CheckCircle2, XCircle, Loader2, Home, Users, Shield, Clock, UserPlus } from 'lucide-react';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('preview'); // 'preview', 'loading', 'success', 'error', 'declined'
  const [message, setMessage] = useState('');
  const [teamInfo, setTeamInfo] = useState(null);

  const token = searchParams.get('token');
  const isDarkMode = localStorage.getItem('darkMode') === 'true';

  // Fetch invitation preview
  const { data: previewData, isLoading: isLoadingPreview, error: previewError } = useQuery({
    queryKey: ['invitationPreview', token],
    queryFn: () => getInvitationPreview(token),
    enabled: !!token,
    retry: false,
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message || 'Successfully joined the team!');
      setTeamInfo(data.data);
      
      // Redirect to team dashboard after 2 seconds
      setTimeout(() => {
        navigate(`/teams/${data.data.teamId}`);
      }, 2000);
    },
    onError: (error) => {
      setStatus('error');
      setMessage(error.message || 'Failed to accept invitation');
    },
  });

  // Decline invitation mutation
  const declineMutation = useMutation({
    mutationFn: () => declineInvitation(token),
    onSuccess: () => {
      setStatus('declined');
      setMessage('Invitation declined');
    },
    onError: (error) => {
      setStatus('error');
      setMessage(error.message || 'Failed to decline invitation');
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link - missing token');
    }
  }, [token]);

  useEffect(() => {
    if (previewError) {
      setStatus('error');
      setMessage(previewError.message || 'Invalid or expired invitation');
    }
  }, [previewError]);

  const handleAccept = () => {
    setStatus('loading');
    acceptMutation.mutate();
  };

  const handleDecline = () => {
    declineMutation.mutate();
  };

  const invitation = previewData?.data;

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return isDarkMode 
          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
          : 'bg-amber-50 text-amber-600 border-amber-200';
      case 'admin':
        return isDarkMode 
          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
          : 'bg-purple-50 text-purple-600 border-purple-200';
      default:
        return isDarkMode 
          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
          : 'bg-blue-50 text-blue-600 border-blue-200';
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isDarkMode ? 'bg-[rgb(15,20,15)]' : 'bg-gray-50'
    }`}>
      <div className={`max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ${
        isDarkMode ? 'bg-[rgb(30,36,30)] border border-[rgb(45,52,45)]' : 'bg-white border border-gray-200'
      }`}>
        
        {/* Loading Preview */}
        {isLoadingPreview && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <Loader2 className="animate-spin text-[#006239]" size={48} />
            </div>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading invitation...
            </p>
          </div>
        )}

        {/* Preview State - Show invitation details */}
        {status === 'preview' && invitation && (
          <>
            {/* Header with avatars */}
            <div className={`p-8 pb-6 text-center border-b ${
              isDarkMode ? 'border-[rgb(45,52,45)]' : 'border-gray-100'
            }`}>
              {/* Avatar section like the image */}
              <div className="flex items-center justify-center gap-3 mb-6">
                {/* Inviter Avatar */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${
                  isDarkMode ? 'bg-[#006239] text-white' : 'bg-[#006239] text-white'
                }`}>
                  {invitation.inviterAvatar ? (
                    <img 
                      src={invitation.inviterAvatar} 
                      alt={invitation.inviterName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(invitation.inviterName)
                  )}
                </div>
                
                {/* Plus sign */}
                <span className={`text-2xl font-light ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>+</span>
                
                {/* You (placeholder) */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed ${
                  isDarkMode ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'
                }`}>
                  <UserPlus size={24} />
                </div>
              </div>

              {/* Invitation text */}
              <h1 className={`text-xl font-semibold mb-1 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <span className="text-[#006239] font-bold">{invitation.inviterName || 'Someone'}</span>
                {' '}invited you to collaborate
              </h1>
            </div>

            {/* Team Info */}
            <div className="p-6 space-y-4">
              {/* Team Name */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? 'bg-[rgb(40,46,40)]' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    isDarkMode ? 'bg-[#006239]/20 text-[#006239]' : 'bg-[#006239]/10 text-[#006239]'
                  }`}>
                    <Users size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-lg ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {invitation.teamName}
                    </h3>
                    {invitation.teamDescription && (
                      <p className={`text-sm line-clamp-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {invitation.teamDescription}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Role & Member Count */}
              <div className="grid grid-cols-2 gap-3">
                {/* Role */}
                <div className={`p-4 rounded-xl ${
                  isDarkMode ? 'bg-[rgb(40,46,40)]' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                    <span className={`text-xs font-medium ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>Your Role</span>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-semibold capitalize border ${
                    getRoleBadgeColor(invitation.role)
                  }`}>
                    {invitation.role}
                  </span>
                </div>

                {/* Member Count */}
                <div className={`p-4 rounded-xl ${
                  isDarkMode ? 'bg-[rgb(40,46,40)]' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                    <span className={`text-xs font-medium ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>Team Size</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {invitation.memberCount} {invitation.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>

              {/* Expiry info */}
              <div className={`flex items-center gap-2 text-xs ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
                <Clock size={12} />
                <span>
                  Expires {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={`p-6 pt-2 flex gap-3`}>
              <button
                onClick={handleAccept}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                className={`flex-1 px-6 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-[#006239] hover:bg-[#005230] text-white' 
                    : 'bg-[#006239] hover:bg-[#005230] text-white'
                }`}
              >
                {acceptMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Joining...
                  </span>
                ) : (
                  'Accept invitation'
                )}
              </button>
              <button
                onClick={handleDecline}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                className={`px-6 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-[rgb(45,52,45)] hover:bg-[rgb(55,62,55)] text-gray-300' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {declineMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Decline'
                )}
              </button>
            </div>
          </>
        )}

        {/* Loading State (accepting) */}
        {status === 'loading' && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <Loader2 className="animate-spin text-[#006239]" size={64} />
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Joining Team...
            </h1>
            <p className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Please wait while we process your request
            </p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="text-green-500" size={48} />
              </div>
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Welcome to {teamInfo?.teamName || 'the team'}!
            </h1>
            <p className={`text-sm mb-6 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {message}
            </p>
            <div className={`inline-flex items-center gap-2 text-xs ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <Loader2 className="animate-spin" size={14} />
              <span>Redirecting to team dashboard...</span>
            </div>
          </div>
        )}

        {/* Declined State */}
        {status === 'declined' && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <XCircle className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} size={48} />
              </div>
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Invitation Declined
            </h1>
            <p className={`text-sm mb-6 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              You have declined this invitation.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className={`w-full px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                isDarkMode 
                  ? 'bg-[#006239] hover:bg-[#005230] text-white' 
                  : 'bg-[#006239] hover:bg-[#005230] text-white'
              }`}
            >
              <Home size={18} />
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="text-red-500" size={48} />
              </div>
            </div>
            <h1 className={`text-2xl font-bold mb-3 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Unable to Join Team
            </h1>
            <p className={`text-sm mb-6 ${
              isDarkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              {message}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className={`w-full px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  isDarkMode 
                    ? 'bg-[#006239] hover:bg-[#005230] text-white' 
                    : 'bg-[#006239] hover:bg-[#005230] text-white'
                }`}
              >
                <Home size={18} />
                Go to Dashboard
              </button>
              <p className={`text-xs ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Common issues: Invitation expired, already used, or sent to different email
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
