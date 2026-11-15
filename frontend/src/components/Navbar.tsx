import React from 'react';
import { Key, Sparkles, Layout, Flame, Video, Sliders } from 'lucide-react';
import { AppSettings } from '../types';

interface NavbarProps {
  settings: AppSettings | null;
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onNewProject: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  onOpenSettings,
  onOpenTemplates,
  onNewProject,
}) => {
  const hasCustomKey = Boolean(
    settings?.gemini_api_key_masked ||
    settings?.openai_api_key_masked ||
    settings?.groq_api_key_masked
  );

  return (
    <header className="sticky top-0 z-40 border-b border-stream-border/80 bg-stream-dark/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={onNewProject}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-stream-twitch via-stream-accent to-stream-kick flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
            <Flame className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white">StreamClip</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-stream-accent/20 text-indigo-400 border border-indigo-500/30">
                STUDIO AI
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="flex items-center gap-1 hover:text-purple-400 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-stream-twitch"></span>
                Twitch
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 hover:text-green-400 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-stream-kick"></span>
                Kick
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 hover:text-red-400 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-stream-youtube"></span>
                YouTube
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Templates & Samples Button */}
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:text-white bg-stream-card hover:bg-stream-border/60 border border-stream-border transition-all"
            title="Edit Layout Samples & Presets"
          >
            <Layout className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">أنماط المونتاج (Presets)</span>
          </button>

          {/* BYO AI Key Button */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
              hasCustomKey
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                : 'bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/40 animate-pulse'
            }`}
          >
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">
              {hasCustomKey ? 'حساب الـ AI مفعل' : 'إعداد مفتاح الـ AI (BYO API)'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                hasCustomKey ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            ></span>
          </button>

          {/* New Clip / Reset */}
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-stream-accent to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
          >
            <Video className="w-4 h-4" />
            <span>مشروع جديد</span>
          </button>
        </div>
      </div>
    </header>
  );
};
