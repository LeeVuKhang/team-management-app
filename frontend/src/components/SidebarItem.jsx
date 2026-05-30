/**
 * Reusable Sidebar Item Component
 */
export default function SidebarItem({ icon: Icon, label, active = false, hasNotification = false, badgeCount = 0, darkMode, onClick }) {
  const className = `w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group/item relative ${
    active 
      ? darkMode
        ? 'bg-[#171717] text-white' 
        : 'bg-gray-200 text-gray-900'
      : `${darkMode ? 'text-gray-400 hover:bg-[#1F1F1F] hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
  }`;

  return (
    <button 
      className={className}
      title={label}
      onClick={onClick}
    >
      <Icon size={20} className={`flex-shrink-0 ${active ? '' : `${darkMode ? 'text-gray-500' : 'text-gray-500'}`}`} />
      <span className="ml-3 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">{label}</span>
      {hasNotification && (
        <span className="w-2 h-2 rounded-full bg-red-500 absolute top-2 left-2 opacity-100 group-hover:opacity-0"></span>
      )}
      {badgeCount > 0 && (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500 absolute top-2 left-2 opacity-100 group-hover:opacity-0"></span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'bg-[#171717] text-white' : 'bg-gray-800 text-white'}`}>
            {badgeCount}
          </span>
        </>
      )}
    </button>
  );
}
