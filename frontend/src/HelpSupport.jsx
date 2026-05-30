import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Search, 
  ChevronDown, 
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Send,
  Mail,
  Phone,
  MessageCircle,
  HelpCircle,
  BookOpen,
  Users,
  Settings,
  CreditCard,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// FAQ DATA
// ============================================
const FAQ_DATA = [
  {
    id: 1,
    question: 'How do I create a new team?',
    answer: 'To create a new team, go to your Dashboard and click the "New Team" button in the top right corner. Fill in your team name and description, then click "Create Team". You\'ll automatically become the owner of the new team.',
    category: 'getting-started'
  },
  {
    id: 2,
    question: 'How do I invite members to my team?',
    answer: 'Navigate to your team page and click on the "Members" section. Click "Invite Member" and search for users by their email or username. Select the role you want to assign (Admin or Member) and send the invitation. They\'ll receive an email notification.',
    category: 'getting-started'
  },
  {
    id: 3,
    question: 'What are the different member roles?',
    answer: 'There are three roles: Owner (full control, can delete team), Admin (can manage projects and members), and Member (can view and contribute to projects). Only owners can transfer ownership or delete the team.',
    category: 'teams'
  },
  {
    id: 4,
    question: 'How do I create a project within a team?',
    answer: 'Go to your team page and click "Create Project" in the Projects section. Provide a project name, description, and set the start/end dates. You can also assign team members to the project during creation.',
    category: 'getting-started'
  },
  {
    id: 5,
    question: 'How do I change my profile picture?',
    answer: 'Go to Profile Settings (click your avatar in the top right). Click on your current avatar to upload a new image. Supported formats are JPG, PNG, and GIF with a maximum size of 5MB.',
    category: 'account'
  },
  {
    id: 6,
    question: 'How do I connect my Google account?',
    answer: 'In Profile Settings, scroll to "Connected Accounts" section. Click "Connect" next to Google. You\'ll be redirected to Google to authorize the connection. Once connected, you can use Google to sign in.',
    category: 'account'
  },
  {
    id: 7,
    question: 'How do I manage task assignments?',
    answer: 'Open a task by clicking on it. In the task detail panel, you can add or remove assignees, change the status, set due dates, and add comments. All changes are saved automatically.',
    category: 'tasks'
  },
  {
    id: 8,
    question: 'What do the task statuses mean?',
    answer: 'Tasks have four statuses: To Do (not started), In Progress (being worked on), Review (awaiting review), and Done (completed). You can drag tasks between columns or use the status dropdown.',
    category: 'tasks'
  },
  {
    id: 9,
    question: 'How do I use the team chat?',
    answer: 'Click "Chat" in the sidebar to access team conversations. Each team has general channels and project-specific channels. You can share files, links, and use @mentions to notify team members.',
    category: 'teams'
  },
  {
    id: 10,
    question: 'How do I reset my password?',
    answer: 'Click "Forgot Password" on the login page. Enter your email address and we\'ll send you a reset link. The link expires after 24 hours. If you signed up with Google, you don\'t need a password.',
    category: 'account'
  },
  {
    id: 11,
    question: 'How do I leave a team?',
    answer: 'Go to the team page, click the settings icon (gear) in the top right, and select "Leave Team". Note: Team owners cannot leave - you must transfer ownership first or delete the team.',
    category: 'teams'
  },
  {
    id: 12,
    question: 'What is the AI Risk Analysis feature?',
    answer: 'Our AI analyzes your project data to identify potential risks like overdue tasks, workload imbalances, and deadline conflicts. Access it from the project page by clicking "Risk Analysis" in the sidebar.',
    category: 'features'
  },
  {
    id: 13,
    question: 'How do notifications work?',
    answer: 'You receive notifications for: team invitations, task assignments, @mentions in chat, and important updates. Click the bell icon to view all notifications. You can mark them as read or manage preferences in Settings.',
    category: 'features'
  },
  {
    id: 14,
    question: 'Can I export my project data?',
    answer: 'Currently, data export is available for Pro teams. Go to Team Settings > Export Data to download your projects and tasks as CSV or JSON. We\'re working on adding this feature for all users.',
    category: 'features'
  },
  {
    id: 15,
    question: 'How do I delete my account?',
    answer: 'Go to Profile Settings > scroll to the bottom > click "Delete Account". This action is irreversible and will remove all your data. You\'ll need to transfer ownership of any teams you own first.',
    category: 'account'
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: HelpCircle },
  { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
  { id: 'account', label: 'Account', icon: Settings },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { id: 'features', label: 'Features', icon: CreditCard }
];

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * FAQ Item Component - Accordion style
 */
const FAQItem = ({ item, isOpen, onToggle, darkMode }) => {
  const [feedback, setFeedback] = useState(null); // null | 'helpful' | 'not-helpful'

  const handleFeedback = (type) => {
    setFeedback(type);
    toast.success(type === 'helpful' ? 'Thanks for your feedback!' : 'Sorry to hear that. We\'ll improve!');
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      darkMode 
        ? 'border-[#171717] bg-dark-secondary' 
        : 'border-gray-200 bg-white'
    } ${isOpen ? 'shadow-md' : 'hover:shadow-sm'}`}>
      {/* Question Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-5 text-left transition-colors ${
          darkMode ? 'hover:bg-[#171717]/50' : 'hover:bg-gray-50'
        }`}
      >
        <span className={`font-medium pr-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {item.question}
        </span>
        <div className={`flex-shrink-0 p-1 rounded-full transition-colors ${
          isOpen 
            ? 'bg-[#006239]/10 text-[#006239]' 
            : darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* Answer Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className={`px-5 pb-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <p className="text-sm leading-relaxed mb-4">
            {item.answer}
          </p>
          
          {/* Feedback Section */}
          <div className={`flex items-center gap-4 pt-4 border-t ${
            darkMode ? 'border-[#171717]' : 'border-gray-100'
          }`}>
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Was this helpful?
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFeedback('helpful')}
                className={`p-2 rounded-lg transition-all ${
                  feedback === 'helpful'
                    ? 'bg-green-500/10 text-green-500 scale-110'
                    : darkMode 
                      ? 'hover:bg-[#171717] text-gray-400 hover:text-green-400' 
                      : 'hover:bg-gray-100 text-gray-400 hover:text-green-500'
                }`}
                title="Yes, helpful"
              >
                <ThumbsUp size={16} />
              </button>
              <button
                onClick={() => handleFeedback('not-helpful')}
                className={`p-2 rounded-lg transition-all ${
                  feedback === 'not-helpful'
                    ? 'bg-red-500/10 text-red-500 scale-110'
                    : darkMode 
                      ? 'hover:bg-[#171717] text-gray-400 hover:text-red-400' 
                      : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'
                }`}
                title="No, not helpful"
              >
                <ThumbsDown size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Category Tab Component
 */
const CategoryTab = ({ category, isActive, onClick, darkMode }) => {
  const Icon = category.icon;
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
        isActive
          ? 'bg-[#006239] text-white shadow-md'
          : darkMode
            ? 'bg-dark-secondary text-gray-400 hover:bg-[#171717] hover:text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      <Icon size={16} />
      {category.label}
    </button>
  );
};

/**
 * Contact Form Component
 */
const ContactForm = ({ darkMode }) => {
  const [formData, setFormData] = useState({
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    toast.success('Message sent! We\'ll get back to you soon.');
    
    // Reset after showing success
    setTimeout(() => {
      setFormData({ subject: '', message: '' });
      setIsSubmitted(false);
    }, 3000);
  };

  const inputClass = `w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[#006239]/50 ${
    darkMode 
      ? 'bg-[#171717] border-[#171717] text-white placeholder-gray-500' 
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
  }`;

  if (isSubmitted) {
    return (
      <div className={`p-8 rounded-xl border text-center ${
        darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
      }`}>
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h3 className={`text-lg font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Message Sent!
        </h3>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Our support team will respond within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Subject
        </label>
        <input
          type="text"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="What do you need help with?"
          className={inputClass}
        />
      </div>
      
      <div>
        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Message
        </label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Describe your issue or question in detail..."
          rows={5}
          className={`${inputClass} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
          isSubmitting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#006239] hover:bg-[#005230] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={18} />
            Send Message
          </>
        )}
      </button>
    </form>
  );
};

/**
 * Contact Info Card Component
 */
const ContactInfoCard = ({ icon: Icon, title, value, subtitle, darkMode }) => (
  <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
    darkMode 
      ? 'bg-dark-secondary border-[#171717] hover:border-[#006239]/30' 
      : 'bg-white border-gray-200 hover:border-[#006239]/30'
  }`}>
    <div className={`p-3 rounded-lg ${darkMode ? 'bg-[#006239]/10' : 'bg-[#006239]/5'}`}>
      <Icon size={20} className="text-[#006239]" />
    </div>
    <div>
      <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </h4>
      <p className="text-[#006239] font-medium text-sm mt-0.5">
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function HelpSupport() {
  const { isDarkMode } = useOutletContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFAQId, setOpenFAQId] = useState(null);

  // Filter FAQs based on search and category
  const filteredFAQs = useMemo(() => {
    return FAQ_DATA.filter(faq => {
      const matchesSearch = searchQuery === '' || 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  // Dynamic classes
  const cardBg = isDarkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      
      {/* ========================================
          HEADER & SEARCH SECTION
          ======================================== */}
      <div className={`${cardBg} border rounded-2xl p-8 md:p-12 mb-8 text-center`}>
        <div className="max-w-2xl mx-auto">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
            isDarkMode ? 'bg-[#006239]/20' : 'bg-[#006239]/10'
          }`}>
            <HelpCircle size={32} className="text-[#006239]" />
          </div>
          
          {/* Title */}
          <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${textPrimary}`}>
            How can we help you?
          </h1>
          <p className={`text-lg mb-8 ${textSecondary}`}>
            Search our knowledge base or browse categories below
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search 
              size={20} 
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`} 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for answers..."
              className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 text-lg transition-all focus:outline-none focus:border-[#006239] shadow-lg ${
                isDarkMode 
                  ? 'bg-[#171717] border-[#171717] text-white placeholder-gray-500 focus:shadow-[#006239]/10' 
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:shadow-[#006239]/20'
              }`}
            />
            {searchQuery && (
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${textSecondary}`}>
                {filteredFAQs.length} results
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================
          FAQ SECTION
          ======================================== */}
      <div className="mb-12">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${textPrimary}`}>
            Frequently Asked Questions
          </h2>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 overflow-x-auto">
          {CATEGORIES.map(category => (
            <CategoryTab
              key={category.id}
              category={category}
              isActive={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              darkMode={isDarkMode}
            />
          ))}
        </div>

        {/* FAQ List */}
        {filteredFAQs.length === 0 ? (
          <div className={`${cardBg} border rounded-xl p-12 text-center`}>
            <Search size={48} className={`mx-auto mb-4 ${textSecondary}`} />
            <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>
              No results found
            </h3>
            <p className={textSecondary}>
              Try adjusting your search or browse all categories
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
              className="mt-4 text-[#006239] font-medium hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFAQs.map(faq => (
              <FAQItem
                key={faq.id}
                item={faq}
                isOpen={openFAQId === faq.id}
                onToggle={() => setOpenFAQId(openFAQId === faq.id ? null : faq.id)}
                darkMode={isDarkMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ========================================
          CONTACT SUPPORT SECTION
          ======================================== */}
      <div className={`${cardBg} border rounded-2xl p-8`}>
        <div className="text-center mb-8">
          <h2 className={`text-2xl font-bold mb-2 ${textPrimary}`}>
            Still need help?
          </h2>
          <p className={textSecondary}>
            Can't find what you're looking for? Our support team is here for you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
              <MessageCircle size={20} className="text-[#006239]" />
              Send us a message
            </h3>
            <ContactForm darkMode={isDarkMode} />
          </div>

          {/* Contact Info */}
          <div>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
              <Mail size={20} className="text-[#006239]" />
              Other ways to reach us
            </h3>
            <div className="space-y-4">
              <ContactInfoCard
                icon={Mail}
                title="Email Support"
                value="support@teamhub.io"
                subtitle="We respond within 24 hours"
                darkMode={isDarkMode}
              />
              <ContactInfoCard
                icon={Phone}
                title="Phone Support"
                value="+1 (555) 123-4567"
                subtitle="Mon-Fri, 9AM-6PM EST"
                darkMode={isDarkMode}
              />
              <ContactInfoCard
                icon={MessageCircle}
                title="Live Chat"
                value="Available 24/7"
                subtitle="Average response time: 5 minutes"
                darkMode={isDarkMode}
              />
            </div>

            {/* Quick Links */}
            <div className={`mt-6 p-4 rounded-xl ${isDarkMode ? 'bg-[#171717]' : 'bg-gray-50'}`}>
              <h4 className={`text-sm font-medium mb-3 ${textPrimary}`}>
                Quick Links
              </h4>
              <div className="flex flex-wrap gap-2">
                {['Documentation', 'API Reference', 'Status Page', 'Community Forum'].map(link => (
                  <a
                    key={link}
                    href="#"
                    className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      isDarkMode 
                        ? 'bg-dark-secondary text-gray-400 hover:text-[#006239]' 
                        : 'bg-white text-gray-600 hover:text-[#006239] border border-gray-200'
                    }`}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}