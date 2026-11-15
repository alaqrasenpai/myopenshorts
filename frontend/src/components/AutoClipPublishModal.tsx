import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Share2, Sparkles, Image as ImageIcon, 
  Download, Film, Video, CheckCircle2
} from 'lucide-react';
import { ClipItem, Project } from '../types';
import { api, SocialPackage } from '../api/client';

interface AutoClipPublishModalProps {
  clip: ClipItem | null;
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export const AutoClipPublishModal: React.FC<AutoClipPublishModalProps> = ({
  clip,
  project,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !clip) return null;

  const [activePlatform, setActivePlatform] = useState<'tiktok' | 'youtube' | 'instagram'>('tiktok');
  const [socialData, setSocialData] = useState<SocialPackage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Cover image generation
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadPackage();
  }, [clip.id]);

  const loadPackage = async () => {
    setLoading(true);
    try {
      const res = await api.getAutoClipPackage(project.id, clip.id);
      setSocialData(res.package);
    } catch (e: any) {
      console.error('Failed to load AutoClip package:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCover = async () => {
    setGeneratingCover(true);
    try {
      const res = await api.generateCoverThumbnail(
        project.id,
        clip.id,
        clip.start_time + 1.5,
        clip.hook_title
      );
      setCoverUrl(res.cover_url);
    } catch (e: any) {
      alert(`فشل إنشاء الغلاف: ${e.message}`);
    } finally {
      setGeneratingCover(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-stream-card border border-stream-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stream-border bg-stream-dark/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">حزمة النشر الذكي والتسويق (AutoClip Kit)</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Ready to Publish
                </span>
              </div>
              <p className="text-xs text-gray-400">عناوين، وصف، وهاشتاجات مجهزة خصيصاً لكل منصة لزيادة الانتشار</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-stream-border/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-sm">
          
          {/* Section 1: Viral Cover / Thumbnail Generator */}
          <div className="p-4 rounded-xl bg-stream-dark border border-stream-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-right">
              <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>غلاف الفيديو الفيروسي (Viral Thumbnail Cover):</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                استخراج أفضل لقطة بصرية من الكليب مع كتابة العنوان بخط عريض جذاب
              </p>
            </div>

            <div className="flex items-center gap-3">
              {coverUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`http://localhost:8000${coverUrl}`}
                    download="cover.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل صورة الغلاف</span>
                  </a>
                  <button
                    onClick={handleGenerateCover}
                    disabled={generatingCover}
                    className="px-3 py-2 rounded-xl bg-stream-card hover:bg-stream-border text-xs text-gray-300 border border-stream-border"
                  >
                    إعادة توليد
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCover}
                  disabled={generatingCover}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 hover:opacity-90 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{generatingCover ? 'جاري الاستخراج...' : 'توليد الغلاف الآن'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Platform Selection Tabs */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setActivePlatform('tiktok')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  activePlatform === 'tiktok'
                    ? 'bg-black text-white border-white shadow-md'
                    : 'bg-stream-dark border-stream-border text-gray-400 hover:text-white'
                }`}
              >
                <span>TikTok</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePlatform('youtube')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  activePlatform === 'youtube'
                    ? 'bg-red-950/40 text-red-300 border-red-500 shadow-md'
                    : 'bg-stream-dark border-stream-border text-gray-400 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4 text-red-500" />
                <span>YouTube Shorts</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePlatform('instagram')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  activePlatform === 'instagram'
                    ? 'bg-pink-950/40 text-pink-300 border-pink-500 shadow-md'
                    : 'bg-stream-dark border-stream-border text-gray-400 hover:text-white'
                }`}
              >
                <Film className="w-4 h-4 text-pink-500" />
                <span>Instagram Reels</span>
              </button>
            </div>

            {/* Platform Details Display */}
            {socialData && (
              <div className="space-y-4">
                {activePlatform === 'tiktok' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-stream-dark border border-stream-border space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-300">النص والوصف المقترح لـ TikTok:</span>
                        <button
                          onClick={() => copyToClipboard(socialData.tiktok.caption, 'tt_cap')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                        >
                          {copiedKey === 'tt_cap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'tt_cap' ? 'تم النسخ!' : 'نسخ النص بالكامل'}</span>
                        </button>
                      </div>
                      <pre className="text-xs font-sans text-gray-200 whitespace-pre-wrap leading-relaxed bg-stream-card p-3 rounded-lg border border-stream-border/60">
                        {socialData.tiktok.caption}
                      </pre>
                    </div>
                  </div>
                )}

                {activePlatform === 'youtube' && (
                  <div className="space-y-3">
                    {/* YouTube Title */}
                    <div className="p-3.5 rounded-xl bg-stream-dark border border-stream-border space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-300">عنوان الشورت (YouTube Title):</span>
                        <button
                          onClick={() => copyToClipboard(socialData.youtube_shorts.title, 'yt_title')}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                        >
                          {copiedKey === 'yt_title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'yt_title' ? 'تم النسخ!' : 'نسخ'}</span>
                        </button>
                      </div>
                      <div className="font-bold text-white text-xs bg-stream-card p-2.5 rounded-lg border border-stream-border/60">
                        {socialData.youtube_shorts.title}
                      </div>
                    </div>

                    {/* YouTube Description */}
                    <div className="p-3.5 rounded-xl bg-stream-dark border border-stream-border space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-300">الوصف (Description):</span>
                        <button
                          onClick={() => copyToClipboard(socialData.youtube_shorts.description, 'yt_desc')}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                        >
                          {copiedKey === 'yt_desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'yt_desc' ? 'تم النسخ!' : 'نسخ'}</span>
                        </button>
                      </div>
                      <pre className="text-xs font-sans text-gray-300 whitespace-pre-wrap bg-stream-card p-2.5 rounded-lg border border-stream-border/60">
                        {socialData.youtube_shorts.description}
                      </pre>
                    </div>
                  </div>
                )}

                {activePlatform === 'instagram' && (
                  <div className="p-4 rounded-xl bg-stream-dark border border-stream-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-300">كابشن وهاشتاجات Instagram Reels:</span>
                      <button
                        onClick={() => copyToClipboard(socialData.instagram_reels.caption, 'ig_cap')}
                        className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 font-semibold"
                      >
                        {copiedKey === 'ig_cap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'ig_cap' ? 'تم النسخ!' : 'نسخ'}</span>
                      </button>
                    </div>
                    <pre className="text-xs font-sans text-gray-200 whitespace-pre-wrap leading-relaxed bg-stream-card p-3 rounded-lg border border-stream-border/60">
                      {socialData.instagram_reels.caption}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
