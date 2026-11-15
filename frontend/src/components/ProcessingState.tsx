import React from 'react';
import { 
  DownloadCloud, Volume2, FileText, Crosshair, 
  Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw, PlusCircle
} from 'lucide-react';
import { Project } from '../types';

interface ProcessingStateProps {
  project: Project;
  onRetry?: () => void;
  onNewStream?: () => void;
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({ 
  project,
  onRetry,
  onNewStream,
}) => {
  const isError = project.status === 'error';

  const steps = [
    {
      id: 'download',
      label: 'تحميل الستريم وتجهيز الفيديو (m3u8/HLS)',
      icon: DownloadCloud,
      threshold: 20,
    },
    {
      id: 'audio',
      label: 'استخراج الصوت وتحليل قمم الحماس والصراخ',
      icon: Volume2,
      threshold: 35,
    },
    {
      id: 'transcribe',
      label: 'تفريغ الكلام وتوقيت الكلمات بدقة (Whisper)',
      icon: FileText,
      threshold: 60,
    },
    {
      id: 'vision',
      label: 'الرؤية الحاسوبية وتحديد كاميرا الستريمر',
      icon: Crosshair,
      threshold: 75,
    },
    {
      id: 'ai',
      label: 'الذكاء الاصطناعي واكتشاف اللقطات الفيروسية',
      icon: Sparkles,
      threshold: 95,
    },
  ];

  const currentProgress = project.progress || 10;

  return (
    <div className="w-full max-w-3xl mx-auto my-12" dir="rtl">
      <div className="bg-stream-card border border-stream-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isError
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
            }`}>
              {isError ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isError ? 'حدث خطأ أثناء معالجة الستريم' : 'جاري تحليل ومونتاج الستريم بالذكاء الاصطناعي...'}
              </h2>
              <p className="text-xs text-gray-400">{project.title}</p>
            </div>
          </div>
          
          <div className={`text-2xl font-black ${isError ? 'text-rose-400' : 'text-indigo-400'}`}>
            {isError ? 'خطأ' : `${Math.min(100, Math.round(currentProgress))}%`}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-stream-dark rounded-full overflow-hidden border border-stream-border/80 mb-6">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isError
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-stream-twitch via-stream-accent to-stream-kick'
            }`}
            style={{ width: `${isError ? 100 : currentProgress}%` }}
          ></div>
        </div>

        {/* Live Status Message / Error Message */}
        <div className={`p-4 rounded-xl border mb-6 text-xs flex items-center justify-between gap-3 ${
          isError
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            : 'bg-stream-dark/70 border-stream-border text-gray-300'
        }`}>
          <div className="flex items-center gap-2">
            {!isError && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>}
            <span className="font-semibold text-gray-200">العملية الحالية:</span>
            <span className={isError ? 'text-rose-300 font-mono' : 'text-indigo-300 font-mono'}>
              {project.status_message}
            </span>
          </div>

          {isError && (
            <div className="flex items-center gap-2 shrink-0">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
              {onNewStream && (
                <button
                  type="button"
                  onClick={onNewStream}
                  className="px-3 py-1.5 rounded-lg bg-stream-dark hover:bg-stream-border text-gray-200 text-xs border border-stream-border transition-colors flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>ستريم جديد</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Steps Pipeline Visualizer */}
        <div className="space-y-3">
          {steps.map((step) => {
            const isDone = !isError && currentProgress >= step.threshold;
            const isCurrent = !isError && !isDone && currentProgress >= (step.threshold - 20);
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isDone
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : isCurrent
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200 shadow-sm'
                    : 'bg-stream-dark/30 border-stream-border/40 text-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isCurrent
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'bg-stream-border/40 text-gray-500'
                    }`}
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">{step.label}</span>
                </div>

                <div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <span className="text-[10px] text-gray-500 font-mono">في الانتظار</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
