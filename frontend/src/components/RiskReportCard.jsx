import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Users,
  Target,
  Brain,
  Sparkles,
} from 'lucide-react';

/**
 * Risk Level Badge Component
 */
const RiskLevelBadge = ({ level, score }) => {
  const config = {
    Low: {
      icon: ShieldCheck,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      gradient: 'from-green-500/20 to-green-600/20',
    },
    Medium: {
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      gradient: 'from-amber-500/20 to-amber-600/20',
    },
    High: {
      icon: ShieldAlert,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      gradient: 'from-orange-500/20 to-orange-600/20',
    },
    Critical: {
      icon: AlertOctagon,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      gradient: 'from-red-500/20 to-red-600/20',
    },
  };

  const { icon: Icon, color, bg, border } = config[level] || config.Medium;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${bg} ${border} border`}>
      <Icon size={16} className={color} />
      <span className={`text-sm font-bold ${color}`}>{level}</span>
      <span className={`text-xs font-medium ${color} opacity-80`}>({score}/100)</span>
    </div>
  );
};

/**
 * Risk Score Gauge Component
 */
const RiskScoreGauge = ({ score, darkMode }) => {
  const getColor = (score) => {
    if (score <= 25) return '#22c55e'; // green
    if (score <= 50) return '#f59e0b'; // amber
    if (score <= 75) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const color = getColor(score);
  const rotation = (score / 100) * 180 - 90;

  return (
    <div className="relative w-32 h-16 mx-auto">
      {/* Background arc */}
      <svg viewBox="0 0 100 50" className="w-full h-full">
        <path
          d="M 5 50 A 45 45 0 0 1 95 50"
          fill="none"
          stroke={darkMode ? '#374151' : '#e5e7eb'}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 5 50 A 45 45 0 0 1 95 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 141.4} 141.4`}
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex items-end justify-center pb-1">
        <span className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {score}
        </span>
      </div>
    </div>
  );
};

/**
 * Risk Factor Item Component
 */
const RiskFactorItem = ({ factor, darkMode }) => {
  const severityConfig = {
    low: { color: 'text-green-500', bg: 'bg-green-500/10' },
    medium: { color: 'text-amber-500', bg: 'bg-amber-500/10' },
    high: { color: 'text-orange-500', bg: 'bg-orange-500/10' },
    critical: { color: 'text-red-500', bg: 'bg-red-500/10' },
  };

  const severity = factor.severity?.toLowerCase() || 'medium';
  const { color, bg } = severityConfig[severity] || severityConfig.medium;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${darkMode ? 'bg-[#171717]/50' : 'bg-gray-50'}`}>
      <div className={`p-1.5 rounded-md ${bg}`}>
        <AlertTriangle size={14} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          {factor.factor}
        </p>
        <span className={`text-xs font-medium uppercase ${color}`}>
          {severity} severity
        </span>
      </div>
    </div>
  );
};

/**
 * Suggested Action Item Component
 */
const SuggestedActionItem = ({ action, index, darkMode }) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg ${darkMode ? 'bg-[#006239]/20' : 'bg-green-50'}`}>
    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
      darkMode ? 'bg-[#006239] text-white' : 'bg-green-500 text-white'
    }`}>
      {index + 1}
    </div>
    <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
      {action}
    </p>
  </div>
);

/**
 * Main Risk Report Card Component
 */
export const RiskReportCard = ({ 
  report, 
  isLoading, 
  onRefresh, 
  darkMode,
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  if (isLoading) {
    return (
      <div className={`rounded-xl border p-6 ${
        darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-center gap-3 py-8">
          <RefreshCw className="animate-spin text-blue-500" size={24} />
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            AI đang phân tích dự án...
          </span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`rounded-xl border p-6 ${
        darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Brain className={darkMode ? 'text-gray-600' : 'text-gray-300'} size={40} />
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Chưa có báo cáo phân tích rủi ro
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 px-4 py-2 rounded-lg bg-[#006239] text-white text-sm font-medium hover:bg-[#005230] transition-colors flex items-center gap-2"
            >
              <Sparkles size={16} />
              Phân tích ngay
            </button>
          )}
        </div>
      </div>
    );
  }

  // Parse JSONB fields if they're strings
  const riskFactors = typeof report.risk_factors === 'string' 
    ? JSON.parse(report.risk_factors) 
    : report.risk_factors || [];
  
  const suggestedActions = typeof report.suggested_actions === 'string'
    ? JSON.parse(report.suggested_actions)
    : report.suggested_actions || [];

  const analysisContext = typeof report.analysis_context === 'string'
    ? JSON.parse(report.analysis_context)
    : report.analysis_context || {};

  return (
    <div className={`rounded-xl border overflow-hidden ${
      darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${darkMode ? 'border-[#171717]' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#171717]' : 'bg-gray-100'}`}>
              <Brain className={darkMode ? 'text-blue-400' : 'text-blue-500'} size={20} />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                AI Risk Analysis
              </h3>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Powered by Gemini 2.5 Flash
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <RiskLevelBadge level={report.risk_level} score={report.risk_score} />
            {onRefresh && (
              <button
                onClick={onRefresh}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-[#171717] text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
                title="Phân tích lại"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Risk Score & Summary */}
      <div className={`p-4 ${darkMode ? 'bg-[#171717]/30' : 'bg-gray-50'}`}>
        <div className="flex items-start gap-4">
          <RiskScoreGauge score={report.risk_score} darkMode={darkMode} />
          <div className="flex-1">
            <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      {compact && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            darkMode 
              ? 'hover:bg-[#171717]/50 text-gray-400' 
              : 'hover:bg-gray-50 text-gray-500'
          }`}
        >
          {isExpanded ? (
            <>Collapse <ChevronUp size={16} /></>
          ) : (
            <>View details <ChevronDown size={16} /></>
          )}
        </button>
      )}

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          {analysisContext && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-[#171717]/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={14} className={darkMode ? 'text-blue-400' : 'text-blue-500'} />
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Progress
                  </span>
                </div>
                <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {analysisContext.progressPercent || 0}%
                </p>
              </div>
              
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-[#171717]/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className={darkMode ? 'text-amber-400' : 'text-amber-500'} />
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Overdue
                  </span>
                </div>
                <p className={`text-lg font-bold ${
                  analysisContext.overdueCount > 0 
                    ? 'text-red-500' 
                    : darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {analysisContext.overdueCount || 0}
                </p>
              </div>
              
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-[#171717]/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className={darkMode ? 'text-orange-400' : 'text-orange-500'} />
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Urgent
                  </span>
                </div>
                <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {analysisContext.urgentPendingCount || 0}
                </p>
              </div>
              
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-[#171717]/50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className={darkMode ? 'text-purple-400' : 'text-purple-500'} />
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Team Size
                  </span>
                </div>
                <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {analysisContext.teamSize || 0}
                </p>
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {riskFactors.length > 0 && (
            <div>
              <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${
                darkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                <AlertTriangle size={16} className="text-amber-500" />
                Risk Factors ({riskFactors.length})
              </h4>
              <div className="space-y-2">
                {riskFactors.map((factor, idx) => (
                  <RiskFactorItem key={idx} factor={factor} darkMode={darkMode} />
                ))}
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {suggestedActions.length > 0 && (
            <div>
              <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${
                darkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                <Lightbulb size={16} className="text-green-500" />
                Suggested Actions ({suggestedActions.length})
              </h4>
              <div className="space-y-2">
                {suggestedActions.map((action, idx) => (
                  <SuggestedActionItem key={idx} action={action} index={idx} darkMode={darkMode} />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={`pt-3 border-t flex items-center justify-between text-xs ${
            darkMode ? 'border-[#171717] text-gray-500' : 'border-gray-100 text-gray-400'
          }`}>
            <span>
              Analyzed: {new Date(report.created_at).toLocaleString('vi-VN')}
            </span>
            {report.cached && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                Cached
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Risk Analysis Modal for detailed view
 */
export const RiskAnalysisModal = ({ 
  isOpen, 
  onClose, 
  report, 
  isLoading, 
  onRefresh, 
  darkMode 
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl ${
          darkMode ? 'bg-dark-secondary' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
          darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
        }`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Project Risk Analysis
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-[#171717] text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <RiskReportCard 
            report={report}
            isLoading={isLoading}
            onRefresh={onRefresh}
            darkMode={darkMode}
            compact={false}
          />
        </div>
      </div>
    </div>
  );
};

export default RiskReportCard;
