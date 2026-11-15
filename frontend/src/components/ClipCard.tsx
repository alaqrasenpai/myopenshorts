import React, { useRef, useState } from 'react';
import { 
  Clock, Flame, Sliders, Download, Sparkles, Scissors, Share2, 
  Play, Pause, Volume2, VolumeX, Maximize2, Film
} from 'lucide-react';
import { ClipItem } from '../types';

interface ClipCardProps {
  clip: ClipItem;
  index: number;
  onOpenStudio: (clip: ClipItem) => void;
  onOpenOpenCut: (clip: ClipItem) => void;
  onOpenAutoClip: (clip: ClipItem) => void;
  onQuickRender: (clip: ClipItem) => void;
  onWatchVideo?: (clip: ClipItem) => void;
  isRendering: boolean;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  onOpenStudio,
  onOpenOpenCut,
  onOpenAutoClip,
  onQuickRender,
  onWatchVideo,
  isRendering,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (score >= 80) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const videoUrl = clip.rendered_url ? `http://localhost:8000${clip.rendered_url}` : null;

  return (
    <div 
      className="bg-stream-card border border-stream-border hover:border-indigo-500/40 rounded-2xl p-5 shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
      dir="rtl"
    >
      <div>
        {/* Top Bar: Timeline & Virality Score */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${getScoreColor(clip.virality_score)}`}>
            <Flame className="w-3.5 h-3.5" />
            <span>Virality Score: {clip.virality_score}/100</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stream-dark border border-stream-border text-[11px] font-mono text-indigo-300">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>{clip.timeline_range}</span>
            <span className="text-gray-400 text-[10px]">({clip.duration}s)</span>
          </div>
        </div>

        {/* Embedded Video Player if Rendered */}
        {videoUrl && (
          <div className="mb-4 relative rounded-xl overflow-hidden bg-black border border-stream-border/80 shadow-lg group/player flex flex-col items-center justify-center">
            <div className="relative w-full aspect-[9/16] max-h-[360px] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                loop
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
                className="w-full h-full object-contain cursor-pointer"
              />

              {/* Play Overlay Button */}
              {!isPlaying && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl backdrop-blur-sm transition-transform hover:scale-110 z-10"
                >
                  <Play className="w-6 h-6 ml-0.5" />
                </button>
              )}

              {/* Top Controls Overlay */}
              <div className="absolute top-2 inset-x-2 flex items-center justify-between z-10">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/90 text-white shadow">
                  ✨ 9:16 Short جاهز
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs transition-colors"
                    title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  {onWatchVideo && (
                    <button
                      type="button"
                      onClick={() => onWatchVideo(clip)}
                      className="p-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs transition-colors"
                      title="مشاهدة بملء الشاشة"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category Tag */}
        <div className="mb-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stream-dark text-gray-300 border border-stream-border/80 uppercase">
            {clip.category || 'Highlight'}
          </span>
        </div>

        {/* Hook Title */}
        <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 mb-2">
          {clip.hook_title}
        </h3>

        {/* AI Rationale */}
        <p className="text-xs text-gray-400 line-clamp-2 mb-4 bg-stream-dark/40 p-2.5 rounded-xl border border-stream-border/40">
          <span className="font-semibold text-gray-300">سبب الاختيار: </span>
          {clip.reason}
        </p>

        {/* Tags */}
        {clip.tags && clip.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {clip.tags.slice(0, 4).map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-stream-dark/80 text-gray-400">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons Row 1: Watch / Download / Render */}
      <div className="pt-3 border-t border-stream-border/80 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {clip.rendered_url ? (
            <>
              {onWatchVideo && (
                <button
                  onClick={() => onWatchVideo(clip)}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-stream-twitch to-stream-accent hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>مشاهدة الكليب (Play)</span>
                </button>
              )}

              <a
                href={`http://localhost:8000${clip.rendered_url}`}
                download={clip.rendered_file}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                title="تحميل ملف MP4 مباشرة"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل</span>
              </a>
            </>
          ) : (
            <button
              onClick={() => onQuickRender(clip)}
              disabled={isRendering}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-stream-twitch to-stream-accent hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRendering ? 'جاري الرندرة...' : 'مونتاج فوري (9:16)'}</span>
            </button>
          )}

          {/* Social AutoClip Package button */}
          <button
            onClick={() => onOpenAutoClip(clip)}
            className="p-2 rounded-xl bg-stream-dark hover:bg-amber-950/40 text-amber-400 border border-stream-border hover:border-amber-500/40 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="حزمة النشر الذكي والغلاف (AutoClip)"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">النشر والغلاف</span>
          </button>
        </div>

        {/* Action Buttons Row 2: OpenCut Manual Edit & Clip Studio */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onOpenOpenCut(clip)}
            className="py-1.5 px-2 rounded-lg bg-pink-950/20 hover:bg-pink-950/40 text-pink-300 border border-pink-500/30 transition-colors flex items-center justify-center gap-1 text-[11px] font-bold"
            title="تعديل يدوي بالتايم لاين عبر OpenCut"
          >
            <Scissors className="w-3 h-3 text-pink-400" />
            <span>تعديل يدوي (OpenCut)</span>
          </button>

          <button
            onClick={() => onOpenStudio(clip)}
            className="py-1.5 px-2 rounded-lg bg-stream-dark hover:bg-stream-border text-gray-300 hover:text-white border border-stream-border transition-colors flex items-center justify-center gap-1 text-[11px] font-semibold"
            title="تخصيص زوايا المونتاج ونمط الترجمة"
          >
            <Sliders className="w-3 h-3 text-indigo-400" />
            <span>استوديو القوالب</span>
          </button>
        </div>
      </div>
    </div>
  );
};
