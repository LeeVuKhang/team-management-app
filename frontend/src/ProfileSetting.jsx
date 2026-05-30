import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Camera, 
  User, 
  Mail, 
  Shield, 
  Check, 
  Loader2, 
  Save,
  Link as LinkIcon,
  AlertCircle,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as userService from './services/userService';

/**
 * Google Icon Component
 */
const GoogleIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

/**
 * GitHub Icon Component
 */
const GitHubIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

/**
 * Connected Account Badge Component
 */
const OAuthBadge = ({ provider, isLinked, darkMode }) => {
  const config = {
    google: {
      icon: GoogleIcon,
      name: 'Google',
      linkedColor: darkMode ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-600',
      unlinkedColor: darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-500',
    },
    github: {
      icon: GitHubIcon,
      name: 'GitHub',
      linkedColor: darkMode ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-600',
      unlinkedColor: darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-500',
    },
  };

  const { icon: Icon, name, linkedColor, unlinkedColor } = config[provider];
  const colorClass = isLinked ? linkedColor : unlinkedColor;

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${colorClass}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          darkMode ? 'bg-gray-700' : 'bg-white'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {name}
          </p>
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {isLinked ? 'Connected to your account' : 'Not connected'}
          </p>
        </div>
      </div>
      
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        isLinked 
          ? (darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
          : (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
      }`}>
        {isLinked ? (
          <>
            <Check size={14} />
            Connected
          </>
        ) : (
          <>
            <LinkIcon size={14} />
            Not linked
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Avatar Upload Component
 */
const AvatarUpload = ({ currentAvatar, previewUrl, onFileSelect, darkMode, username }) => {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      onFileSelect(file);
    }
  };

  const displayUrl = previewUrl || currentAvatar;
  const initials = username?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex flex-col items-center">
      <div 
        onClick={handleClick}
        className={`relative w-32 h-32 rounded-full overflow-hidden cursor-pointer border-4 transition-all hover:border-[#006239] ${
          darkMode ? 'border-[#171717] bg-gray-800' : 'border-gray-200 bg-gray-100'
        }`}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-[#006239] text-white">
            {initials}
          </div>
        )}
        
        {/* Overlay - now properly contained within the rounded parent */}
        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera size={28} className="text-white" />
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      
      <p className={`text-center text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Click to change avatar
      </p>
    </div>
  );
};

/**
 * Main Profile Settings Page
 */
export default function ProfileSetting() {
  const { isDarkMode } = useOutletContext();
  const queryClient = useQueryClient();
  
  // Form state
  const [username, setUsername] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch user profile
  const { data: profileData, isLoading, isError, error } = useQuery({
    queryKey: ['userProfile'],
    queryFn: userService.getMe,
    staleTime: 5 * 60 * 1000,
  });

  const user = profileData?.data;

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
    }
  }, [user]);

  // Check for changes
  useEffect(() => {
    if (user) {
      const usernameChanged = username !== user.username;
      const fileChanged = selectedFile !== null;
      setHasChanges(usernameChanged || fileChanged);
    }
  }, [username, selectedFile, user]);

  // Handle file selection
  const handleFileSelect = (file) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (username !== user?.username) {
        formData.append('username', username);
      }
      if (selectedFile) {
        formData.append('avatar', selectedFile);
      }
      return userService.updateProfile(formData);
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      queryClient.invalidateQueries(['userProfile']);
      queryClient.invalidateQueries(['currentUser']);
      setSelectedFile(null);
      setPreviewUrl(null);
      setHasChanges(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    },
  });

  // Dynamic classes
  const cardBg = isDarkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200';
  const inputBg = isDarkMode 
    ? 'bg-[#171717] border-[#171717] text-white placeholder-gray-500 focus:ring-[#006239] focus:border-[#006239]' 
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-[#006239] focus:border-[#006239]';
  const labelClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className={`${cardBg} border rounded-xl p-8`}>
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={40} className="text-[#006239] animate-spin mb-4" />
              <p className={textSecondary}>Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className={`${cardBg} border rounded-xl p-8`}>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={40} className="text-red-500 mb-4" />
              <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                Failed to load profile
              </p>
              <p className={`text-sm mt-2 ${textSecondary}`}>
                {error?.message || 'Please try again later'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl md:text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Profile Settings
          </h1>
          <p className={textSecondary}>
            Manage your account settings and preferences
          </p>
        </div>

        {/* Avatar & Basic Info Card */}
        <div className={`${cardBg} border rounded-xl p-6 md:p-8`}>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            
            {/* Avatar Section */}
            <AvatarUpload
              currentAvatar={user?.avatar_url}
              previewUrl={previewUrl}
              onFileSelect={handleFileSelect}
              darkMode={isDarkMode}
              username={user?.username}
            />

            {/* Form Section */}
            <div className="flex-1 w-full space-y-5">
              
              {/* Display Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${labelClass}`}>
                  <User size={14} className="inline mr-2" />
                  Display Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:outline-none transition-all ${inputBg}`}
                />
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${labelClass}`}>
                  <Mail size={14} className="inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className={`w-full px-4 py-3 rounded-lg border cursor-not-allowed opacity-60 ${inputBg}`}
                />
                <p className={`text-xs mt-1.5 ${textSecondary}`}>
                  Email cannot be changed
                </p>
              </div>

              {/* Member Since */}
              <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
                <Calendar size={14} />
                <span>
                  Member since {user?.created_at 
                    ? new Date(user.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })
                    : 'Unknown'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-dashed flex justify-end"
            style={{ borderColor: isDarkMode ? '#333' : '#e5e7eb' }}
          >
            <button
              onClick={() => updateMutation.mutate()}
              disabled={!hasChanges || updateMutation.isPending}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                hasChanges && !updateMutation.isPending
                  ? 'bg-[#006239] hover:bg-[#005230] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Connected Accounts Card */}
        <div className={`${cardBg} border rounded-xl p-6 md:p-8`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-lg ${isDarkMode ? 'bg-[#006239]/20' : 'bg-[#006239]/10'}`}>
              <Shield size={20} className="text-[#006239]" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Connected Accounts
              </h2>
              <p className={`text-sm ${textSecondary}`}>
                Manage your linked social accounts
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <OAuthBadge
              provider="google"
              isLinked={user?.is_google_linked}
              darkMode={isDarkMode}
            />
            <OAuthBadge
              provider="github"
              isLinked={user?.is_github_linked}
              darkMode={isDarkMode}
            />
          </div>

          <p className={`text-xs mt-4 ${textSecondary}`}>
            <AlertCircle size={12} className="inline mr-1" />
            Connected accounts allow you to sign in quickly and securely
          </p>
        </div>

        {/* Auth Provider Info */}
        {user?.auth_provider && (
          <div className={`${cardBg} border rounded-xl p-4`}>
            <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
              <Shield size={14} />
              <span>
                Primary login method: <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {user.auth_provider === 'google' ? 'Google' : 
                   user.auth_provider === 'github' ? 'GitHub' : 
                   'Email & Password'}
                </span>
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}