import React, { useRef, useState, useEffect } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Download, Film } from 'lucide-react';
import { ClipItem } from '../types';

interface VideoPlayerModalProps {
  clip: ClipItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenOpenCut?: (clip: ClipItem) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  clip,
  isOpen,
  onClose,
  onOpenOpenCut,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(clip?.duration || 30);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && clip?.rendered_url) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, clip?.rendered_url]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      onClose();
    }
  };

  if (!clip || !clip.rendered_url) return null;

  const videoSrc = clip.rendered_url;

  const handleDownload = () => {
    if (!clip.rendered_url) return;
    const link = document.createElement('a');
    link.href = clip.rendered_url;
    link.setAttribute('download', clip.rendered_file || 'clip.mp4');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || clip.duration || 30;
    setCurrentTime(curr);
    setDuration(dur);
    setProgress((curr / dur) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(parseFloat(e.target.value));
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleDialogClick}
      aria-labelledby="video-player-modal-title"
      className="p-3 sm:p-6"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-stream-card border border-stream-border rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 border-b border-stream-border bg-stream-dark/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-stream-twitch to-emerald-500 flex items-center justify-center text-white shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="video-player-modal-title" className="text-sm sm:text-base font-black text-white">
                  {clip.hook_title}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Virality: {clip.virality_score}/100
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">التايم لاين: {clip.timeline_range} ({clip.duration} ثانية)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل MP4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المشغل"
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-stream-border/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player Body */}
        <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-hidden">
          <div className="relative h-[65vh] max-h-[620px] aspect-[9/16] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-stream-border/80 flex items-center justify-center group">
            
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              playsInline
              loop
              onTimeUpdate={handleTimeUpdate}
              onClick={togglePlay}
              className="w-full h-full object-cover cursor-pointer"
            />

            {/* Center Big Play Button Overlay if paused */}
            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="تشغيل الفيديو"
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm transition-transform hover:scale-110 z-20"
              >
                <Play className="w-8 h-8 ml-1" />
              </button>
            )}

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              
              {/* Seek Slider */}
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={handleSeek}
                aria-label="مؤشر وقت الفيديو"
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />

              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'إيقاف' : 'تشغيل'} className="hover:text-indigo-400 transition-colors">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={toggleMute} aria-label={isMuted ? 'إلغاء الكتم' : 'كتم'} className="hover:text-indigo-400 transition-colors">
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <span className="font-mono text-[11px] text-gray-300">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-200">
                    9:16 Shorts
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-stream-dark border-t border-stream-border flex items-center justify-between text-xs text-gray-400">
          <div>
            <span>تم المونتاج بدقة 1080x1920 وبترجمة هرموزي التلقائية</span>
          </div>
          {onOpenOpenCut && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOpenCut(clip);
              }}
              className="text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1 transition-colors"
            >
              <span>فتح التعديل اليدوي في OpenCut</span>
            </button>
          )}
        </div>

      </div>
    </dialog>
  );
};
