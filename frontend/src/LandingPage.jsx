import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, FolderKanban, TrendingUp, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-black">Team Hub</h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="text-sm font-semibold text-gray-600 hover:text-black transition-all hover:scale-105 active:scale-95"
              >
                Sign In
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-[#171717] text-white text-sm font-semibold rounded-md hover:bg-[#1F1F1F] transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-black mb-6">
            Manage Your Teams,
            <br />
            Deliver Better Projects
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            A powerful team management platform that helps you organize projects,
            track tasks, and collaborate seamlessly with your team.
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white rounded-lg hover:bg-[#1F1F1F] transition-all text-lg font-medium hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]"
          >
            Start Managing Now
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-xl mb-4">
              <Users size={32} className="text-black" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-3">Team Collaboration</h3>
            <p className="text-gray-600">
              Bring your teams together and work efficiently on shared projects and tasks.
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-xl mb-4">
              <FolderKanban size={32} className="text-black" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-3">Project Management</h3>
            <p className="text-gray-600">
              Track progress, set deadlines, and manage multiple projects from one dashboard.
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-xl mb-4">
              <TrendingUp size={32} className="text-black" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-3">Real-time Analytics</h3>
            <p className="text-gray-600">
              Get insights into team performance and project status at a glance.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-3xl font-bold text-black mb-12 text-center">
              Why Choose TeamFlow?
            </h3>
            <div className="space-y-6">
              {[
                'Intuitive dashboard for quick team overview',
                'Seamless project and task organization',
                'Real-time collaboration features',
                'Track member availability and workload',
                'Modern, clean interface that teams love'
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-4">
                  <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-lg text-gray-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-black mb-4">
            Ready to Transform Your Team Management?
          </h3>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of teams already using TeamFlow to achieve more.
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#171717] text-white rounded-lg hover:bg-[#1F1F1F] transition-all text-lg font-medium hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            © 2025 TeamFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
