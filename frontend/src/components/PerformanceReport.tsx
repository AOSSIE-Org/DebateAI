import React, { useEffect, useState } from 'react';
import {
  PerformanceReport as PerformanceReportType,
  PerformanceReportRequest,
} from '@/types/performanceReport';
import { getOrGeneratePerformanceReport } from '@/services/performanceReportService';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Button } from './ui/button';

interface PerformanceReportProps {
  request: PerformanceReportRequest;
  initialReport?: PerformanceReportType | null;
  onClose?: () => void;
}

export const PerformanceReport: React.FC<PerformanceReportProps> = ({
  request,
  initialReport = null,
}) => {
  const [report, setReport] = useState<PerformanceReportType | null>(initialReport);
  const [loading, setLoading] = useState<boolean>(!initialReport);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrGeneratePerformanceReport(request);
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate performance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialReport && request?.debateId) {
      fetchReport();
    }
  }, [request?.debateId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/80 backdrop-blur rounded-2xl border border-orange-100 shadow-sm space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-orange-500 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center">
          <h4 className="text-lg font-bold text-gray-800">Generating AI Performance Report</h4>
          <p className="text-sm text-gray-500 max-w-sm mt-1">
            Analyzing debate rhetoric, arguments, clarity, rebuttal effectiveness, and logical structure...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <h4 className="text-md font-bold text-red-800">Unable to load report</h4>
        <p className="text-sm text-red-600">{error}</p>
        <Button
          onClick={fetchReport}
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Retry Analysis
        </Button>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const { overall_scores, argument_breakdown, fallacy_flags, improvement_tips } = report;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getTagBadge = (tag: string) => {
    const normalized = tag.toLowerCase();
    if (normalized === 'strong') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Strong
        </span>
      );
    }
    if (normalized === 'moderate') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Zap className="w-3 h-3 mr-1 text-amber-600" /> Moderate
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
        <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" /> Weak
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-10">
          <Sparkles className="w-36 h-36" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> AI Performance Evaluation
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Debate Performance Report
            </h2>
            <p className="text-orange-100 text-sm mt-1">
              Topic: <span className="font-semibold text-white">"{report.topic}"</span> • Stance: <span className="font-semibold text-white">{report.stance}</span>
            </p>
          </div>
          {report.generated_at && (
            <div className="text-xs text-orange-200 bg-black/20 px-3 py-1.5 rounded-lg self-start md:self-auto">
              Generated: {new Date(report.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Overall Scores Grid */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-orange-500" /> Overall Rhetorical Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Persuasion */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600">Persuasion</span>
              <span className={`text-2xl font-black ${getScoreColor(overall_scores.persuasion)}`}>
                {overall_scores.persuasion}
                <span className="text-xs text-gray-400 font-normal">/100</span>
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${getScoreBg(overall_scores.persuasion)}`}
                style={{ width: `${overall_scores.persuasion}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Weight of evidence & rhetorical pull</p>
          </div>

          {/* Clarity */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600">Clarity & Structure</span>
              <span className={`text-2xl font-black ${getScoreColor(overall_scores.clarity)}`}>
                {overall_scores.clarity}
                <span className="text-xs text-gray-400 font-normal">/100</span>
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${getScoreBg(overall_scores.clarity)}`}
                style={{ width: `${overall_scores.clarity}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Logical progression & articulation</p>
          </div>

          {/* Rebuttal */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600">Rebuttal Effectiveness</span>
              <span className={`text-2xl font-black ${getScoreColor(overall_scores.rebuttal_effectiveness)}`}>
                {overall_scores.rebuttal_effectiveness}
                <span className="text-xs text-gray-400 font-normal">/100</span>
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${getScoreBg(overall_scores.rebuttal_effectiveness)}`}
                style={{ width: `${overall_scores.rebuttal_effectiveness}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Directness in answering opponent points</p>
          </div>
        </div>
      </div>

      {/* Argument Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" /> Argument Breakdown
        </h3>
        {argument_breakdown && argument_breakdown.length > 0 ? (
          <div className="space-y-3">
            {argument_breakdown.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="text-sm font-medium text-gray-900 leading-snug">
                    "{item.statement}"
                  </p>
                  <div>{getTagBadge(item.tag)}</div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed pl-2 border-l-2 border-orange-400">
                  <span className="font-semibold text-gray-700">Analysis:</span> {item.reason}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No specific arguments logged for breakdown.</p>
        )}
      </div>

      {/* Fallacy Flags */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-500" /> Logical Fallacy Detection
        </h3>
        {fallacy_flags && fallacy_flags.length > 0 ? (
          <div className="space-y-3">
            {fallacy_flags.map((fallacy, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    {fallacy.fallacy_type}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 italic">
                  "{fallacy.statement}"
                </p>
                <p className="text-xs text-rose-900 leading-relaxed">
                  {fallacy.explanation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-800">
              Clean logical execution — no major logical fallacies were detected in this debate.
            </p>
          </div>
        )}
      </div>

      {/* Improvement Tips */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-orange-200/70 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" /> Actionable Improvement Tips
        </h3>
        <div className="space-y-3">
          {improvement_tips && improvement_tips.length > 0 ? (
            improvement_tips.map((tip, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 bg-white/90 backdrop-blur rounded-xl p-3.5 border border-orange-100 shadow-2xs"
              >
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">Keep up the strong performance!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceReport;
