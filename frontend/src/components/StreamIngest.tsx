import React, { useState } from 'react';
import { 
  Link2, UploadCloud, Search, Play, Clock, Sparkles, 
  Tv, Film, AlertCircle, CheckCircle2, ChevronRight, Video
} from 'lucide-react';
import { VideoMetadata } from '../types';
import { api } from '../api/client';

interface StreamIngestProps {
  onStartIngestUrl: (url: string) => void;
  onUploadFile: (file: File) => void;
  loading: boolean;
}

export const StreamIngest: React.FC<StreamIngestProps> = ({
  onStartIngestUrl,
  onUploadFile,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [streamUrl, setStreamUrl] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<VideoMetadata | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleInspect = async () => {
    if (!streamUrl.trim()) return;
    setInspecting(true);
    setInspectError(null);
    setPreviewMeta(null);

    try {
      const res = await api.inspectStream(streamUrl.trim());
      setPreviewMeta(res.info);
    } catch (err: any) {
      setInspectError(err.message || 'فشل فحص الرابط. تأكد من صحة الرابط.');
    } finally {
      setInspecting(false);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl.trim()) return;
    onStartIngestUrl(streamUrl.trim());
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const handleStartUpload = () => {
    if (!selectedFile) return;
    onUploadFile(selectedFile);
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    if (h > 0) return `${h}h ${m}m ${seconds}s`;
    return `${m}m ${seconds}s`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto" dir="rtl">
      {/* Hero Badge & Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-emerald-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-300 mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
          <span>الذكاء الاصطناعي لصناعة ومونتاج الكلبسات الاحترافية للستريمرز</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-3">
          حوّل ساعات الستريم إلى <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">كلبسات فيروسية بضغطة واحدة</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
          يقوم الذكاء الاصطناعي باكتشاف أكثر اللقطات إثارة وحماساً، ومونتاجها بتنسيق طولي (9:16) مع وجه الستريمر بالكامل وترجمات متحركة هورموزية جاهزة للنشر على TikTok, Reels, Shorts.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-stream-card border border-stream-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

        {/* Ingest Method Tabs */}
        <div className="flex items-center justify-center p-1 bg-stream-dark rounded-xl border border-stream-border/80 max-w-md mx-auto mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'url'
                ? 'bg-gradient-to-r from-stream-twitch via-stream-accent to-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>رابط ستريم (Twitch / Kick / YouTube)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'upload'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>رفع ملف فيديو</span>
          </button>
        </div>

        {/* Tab 1: URL Input */}
        {activeTab === 'url' && (
          <div className="space-y-4">
            <form onSubmit={handleUrlSubmit} className="space-y-3">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="ضع رابط البث المباشر أو الـ VOD هنا (مثال: twitch.tv/videos/..., kick.com/..., youtube.com/watch?v=...)"
                  value={streamUrl}
                  onChange={(e) => {
                    setStreamUrl(e.target.value);
                    setInspectError(null);
                  }}
                  className="w-full px-4 py-4 pr-12 rounded-xl bg-stream-dark border border-stream-border text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono"
                  dir="ltr"
                />
                <Link2 className="w-5 h-5 text-gray-400 absolute right-4 pointer-events-none" />

                {/* Quick inspect button */}
                <button
                  type="button"
                  onClick={handleInspect}
                  disabled={inspecting || !streamUrl.trim()}
                  className="absolute left-2.5 px-3 py-2 rounded-lg bg-stream-card hover:bg-stream-border text-xs font-semibold text-gray-300 hover:text-white transition-colors border border-stream-border/60 disabled:opacity-40"
                >
                  {inspecting ? 'جاري الفحص...' : 'فحص الرابط'}
                </button>
              </div>

              {/* Supported Platforms badges */}
              <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-medium">المنصات المدعومة:</span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/40 text-purple-300 border border-purple-500/30">
                    <Tv className="w-3.5 h-3.5 text-purple-400" />
                    Twitch (Live & VOD)
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                    <Film className="w-3.5 h-3.5 text-emerald-400" />
                    Kick (Live & VOD)
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/40 text-red-300 border border-red-500/30">
                    <Video className="w-3.5 h-3.5 text-red-400" />
                    YouTube (Streams & Videos)
                  </span>
                </div>
              </div>

              {/* Inspect Error */}
              {inspectError && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{inspectError}</span>
                </div>
              )}

              {/* Inspect Preview Card */}
              {previewMeta && (
                <div className="p-4 rounded-xl bg-stream-dark border border-indigo-500/30 flex flex-col sm:flex-row gap-4 items-center animate-in fade-in duration-200">
                  {previewMeta.thumbnail && (
                    <img
                      src={previewMeta.thumbnail}
                      alt={previewMeta.title}
                      className="w-full sm:w-48 h-28 object-cover rounded-lg border border-stream-border shrink-0 shadow-md"
                    />
                  )}
                  <div className="flex-1 text-right space-y-1.5 w-full">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {previewMeta.platform}
                      </span>
                      {previewMeta.duration > 0 && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatSeconds(previewMeta.duration)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-sm line-clamp-1">
                      {previewMeta.title}
                    </h3>
                    <p className="text-xs text-gray-400">
                      القناة: <span className="text-gray-200 font-semibold">{previewMeta.uploader}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading || !streamUrl.trim()}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-stream-twitch via-stream-accent to-emerald-500 hover:opacity-95 text-white font-black text-base shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {loading ? 'جاري تجهيز وبدء المعالجة...' : 'بدء استخراج ومونتاج الكلبسات بالذكاء الاصطناعي'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: File Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-stream-border hover:border-gray-500 bg-stream-dark/40'
              }`}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept="video/mp4,video/x-matroska,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم اختيار الملف: {selectedFile.name}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    الحجم: {(selectedFile.size / (1024 * 1024)).toFixed(1)} ميجابايت
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-bold text-white text-sm">
                    اسحب وأفلت ملف الفيديو هنا، أو اضغط للاختيار من جهازك
                  </p>
                  <p className="text-xs text-gray-400">
                    يدعم جميع صيغ الفيديو (MP4, MKV, MOV, WebM) بدون حد أقصى
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-base shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                <span>
                  {loading ? 'جاري رفع الفيديو وبدء التحليل...' : 'رفع ومعالجة الفيديو بالذكاء الاصطناعي'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
