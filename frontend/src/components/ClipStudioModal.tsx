import React, { useState } from 'react';
import { 
  X, Play, Sliders, Type, Layout, Download, Sparkles, 
  Clock, Video, CheckCircle2, ChevronRight, Eye, ShieldCheck,
  Camera, Scan, RefreshCw
} from 'lucide-react';
import { ClipItem, Project, LayoutTemplate } from '../types';
import { api } from '../api/client';

interface ClipStudioModalProps {
  clip: ClipItem | null;
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onClipUpdated: (updatedClip: ClipItem) => void;
}

export const ClipStudioModal: React.FC<ClipStudioModalProps> = ({
  clip,
  project,
  isOpen,
  onClose,
  onClipUpdated,
}) => {
  if (!isOpen || !clip) return null;

  // Edit states
  const [layout, setLayout] = useState<string>(clip.selected_layout || 'split_screen');
  const [captionStyle, setCaptionStyle] = useState<string>(clip.selected_caption_style || 'hormozi');
  const [startTime, setStartTime] = useState<number>(clip.start_time);
  const [endTime, setEndTime] = useState<number>(clip.end_time);
  
  // Quadrant coordinate maps
  const quadrantCoordinates: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
    top_left: { x: 0.0, y: 0.05, w: 0.28, h: 0.35, label: 'أعلى يسار' },
    top_right: { x: 0.70, y: 0.05, w: 0.28, h: 0.35, label: 'أعلى يمين' },
    center_left: { x: 0.0, y: 0.16, w: 0.28, h: 0.35, label: 'وسط يسار (شائع)' },
    center_right: { x: 0.70, y: 0.16, w: 0.28, h: 0.35, label: 'وسط يمين' },
    bottom_left: { x: 0.0, y: 0.58, w: 0.28, h: 0.35, label: 'أسفل يسار' },
    bottom_right: { x: 0.70, y: 0.58, w: 0.28, h: 0.35, label: 'أسفل يمين' },
  };

  // Facecam position fine-tuning
  const initialFaceBox = clip.face_box || project.facecam_info;
  const initialQuadrant = initialFaceBox?.quadrant || 'top_left';
  const [faceQuadrant, setFaceQuadrant] = useState<string>(initialQuadrant);
  const [customFaceBox, setCustomFaceBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: initialFaceBox?.x ?? 0.0,
    y: initialFaceBox?.y ?? 0.16,
    w: initialFaceBox?.w ?? 0.28,
    h: initialFaceBox?.h ?? 0.35,
  });

  const [isDetectingCam, setIsDetectingCam] = useState<boolean>(false);
  const [detectSuccessMsg, setDetectSuccessMsg] = useState<string | null>(null);

  const [rendering, setRendering] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(clip.rendered_url || null);
  const [renderedFile, setRenderedFile] = useState<string | null>(clip.rendered_file || null);

  const duration = Math.max(1, Math.round((endTime - startTime) * 10) / 10);

  const handleSelectQuadrant = (quadKey: string) => {
    setFaceQuadrant(quadKey);
    const coords = quadrantCoordinates[quadKey];
    if (coords) {
      setCustomFaceBox({ x: coords.x, y: coords.y, w: coords.w, h: coords.h });
    }
  };

  const handleAutoDetectCamera = async () => {
    setIsDetectingCam(true);
    setDetectSuccessMsg(null);
    try {
      const res = await api.detectFacecam({
        project_id: project.id,
        clip_id: clip.id,
        start_time: startTime,
        end_time: endTime,
      });
      if (res.facecam_info) {
        setCustomFaceBox({
          x: res.facecam_info.x,
          y: res.facecam_info.y,
          w: res.facecam_info.w,
          h: res.facecam_info.h,
        });
        const quad = res.facecam_info.quadrant || 'top_left';
        setFaceQuadrant(quad);
        setDetectSuccessMsg(`تم كشف الكاميرا بنجاح: ${quadrantCoordinates[quad]?.label || quad} (دقة ${Math.round(res.facecam_info.confidence * 100)}%)`);
      }
    } catch (e: any) {
      alert(`تعذر الكشف التلقائي: ${e.message}`);
    } finally {
      setIsDetectingCam(false);
    }
  };

  const handleRender = async () => {
    setRendering(true);
    try {
      const faceBox = customFaceBox || quadrantCoordinates[faceQuadrant] || quadrantCoordinates['top_left'];
      const res = await api.renderClip({
        project_id: project.id,
        clip_id: clip.id,
        start_time: startTime,
        end_time: endTime,
        layout: layout,
        caption_style: captionStyle,
        face_box: faceBox,
      });

      setRenderedUrl(res.download_url);
      setRenderedFile(res.filename);

      // Notify parent
      onClipUpdated({
        ...clip,
        start_time: startTime,
        end_time: endTime,
        duration: duration,
        rendered_url: res.download_url,
        rendered_file: res.filename,
        selected_layout: layout,
        selected_caption_style: captionStyle,
        face_box: {
          ...faceBox,
          quadrant: faceQuadrant,
          confidence: 1.0,
        },
      });
    } catch (err: any) {
      alert(`خطأ أثناء الرندرة: ${err.message}`);
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl bg-stream-card border border-stream-border rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stream-border bg-stream-dark/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">استوديو مونتاج وتخصيص الكليب (9:16)</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Virality: {clip.virality_score}/100
                </span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-1">{clip.hook_title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-stream-border/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Body: Left is 9:16 Live Canvas Preview, Right is Controls */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Preview Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-stream-dark/60 rounded-2xl p-4 border border-stream-border/80">
            <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>معاينة الإخراج الطولي (9:16 Vertical Preview)</span>
            </div>

            {/* Simulated 9:16 Mobile Screen Container */}
            <div className="w-[230px] h-[408px] bg-black rounded-2xl border-4 border-stream-border overflow-hidden shadow-2xl relative flex flex-col">
              
              {renderedUrl ? (
                /* Live Real Video Player if Rendered */
                <div className="w-full h-full relative bg-black flex items-center justify-center">
                  <video
                    src={renderedUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2 text-[8px] font-black tracking-widest text-white/80 bg-emerald-600/80 px-1.5 py-0.5 rounded shadow z-10 pointer-events-none">
                    فيديو جاهز
                  </div>
                </div>
              ) : (
                <>
                  {/* Preset 1: Streamer Split (Facecam Top + Gameplay Bottom) */}
                  {layout === 'split_screen' && (
                    <div className="w-full h-full flex flex-col">
                      {/* Top: Facecam Box */}
                      <div className="h-[38%] bg-gradient-to-b from-purple-900/60 to-indigo-900/40 relative border-b-2 border-indigo-500 flex flex-col items-center justify-center overflow-hidden">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-black/60 px-2 py-0.5 rounded-full border border-purple-500/40 z-10">
                          وجه الستريمر (Facecam: {quadrantCoordinates[faceQuadrant]?.label || faceQuadrant})
                        </span>
                        <div className="absolute inset-0 bg-cover bg-center opacity-40" 
                          style={{ backgroundImage: `url(${project.metadata?.thumbnail || ''})` }}>
                        </div>
                      </div>

                      {/* Bottom: Gameplay */}
                      <div className="h-[62%] bg-gradient-to-t from-gray-900 to-slate-900 relative flex flex-col items-center justify-center overflow-hidden">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full border border-emerald-500/40 mb-2 z-10">
                          شاشة اللعبة / الستريم (Gameplay)
                        </span>
                        <div className="absolute inset-0 bg-cover bg-center opacity-30" 
                          style={{ backgroundImage: `url(${project.metadata?.thumbnail || ''})` }}>
                        </div>
                      </div>
                    </div>
                  )}

              {/* Preset 2: Blurred Background */}
              {layout === 'blur_background' && (
                <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                  <div 
                    className="absolute inset-0 bg-cover bg-center blur-md scale-125 opacity-50"
                    style={{ backgroundImage: `url(${project.metadata?.thumbnail || ''})` }}
                  ></div>
                  <div className="relative w-full h-[35%] bg-black/80 border-y border-white/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white bg-black/70 px-2 py-0.5 rounded">
                      شاشة الستريم الأصلية (16:9)
                    </span>
                  </div>
                </div>
              )}

              {/* Preset 3: Face Track */}
              {layout === 'face_track' && (
                <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-slate-900">
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-60 scale-150"
                    style={{ backgroundImage: `url(${project.metadata?.thumbnail || ''})` }}
                  ></div>
                  <span className="relative text-[10px] font-bold text-indigo-300 bg-black/80 px-2.5 py-1 rounded-full border border-indigo-500/40">
                    تتبع حركة وجه الستريمر بالكامل (9:16)
                  </span>
                </div>
              )}

              {/* Dynamic Animated Subtitles Simulation */}
              {captionStyle !== 'none' && (
                <div className="absolute bottom-10 left-3 right-3 text-center pointer-events-none z-10">
                  {captionStyle === 'hormozi' && (
                    <div className="font-black text-sm uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                      <span className="text-white">LOOK AT THIS </span>
                      <span className="text-amber-400 text-base scale-110 inline-block bg-black/60 px-1 rounded">INSANE</span>
                      <span className="text-white"> CLUTCH! 🔥</span>
                    </div>
                  )}

                  {captionStyle === 'neon' && (
                    <div className="font-black text-sm uppercase tracking-wide text-fuchsia-400 drop-shadow-[0_0_8px_rgba(255,0,255,0.8)]">
                      <span>UNBELIEVABLE </span>
                      <span className="text-cyan-300">REACTION ⚡</span>
                    </div>
                  )}

                  {captionStyle === 'karaoke' && (
                    <div className="font-bold text-xs text-white bg-black/70 px-2 py-1 rounded-lg border border-white/20 inline-block">
                      <span className="text-emerald-400">Oh my god </span>
                      <span>did you see that!</span>
                    </div>
                  )}

                  {captionStyle === 'minimal' && (
                    <div className="font-medium text-xs text-white bg-black/50 px-2 py-0.5 rounded inline-block">
                      What a moment in the stream!
                    </div>
                  )}
                </div>
              )}

              {/* Watermark / Brand corner badge */}
              <div className="absolute top-2 right-2 text-[8px] font-black tracking-widest text-white/50 bg-black/40 px-1.5 py-0.5 rounded">
                STREAMCLIP
              </div>
            </>
          )}
        </div>

            {/* Download Button if Rendered */}
            {renderedUrl && (
              <div className="mt-4 w-full">
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = renderedUrl;
                    link.setAttribute('download', renderedFile || 'clip.mp4');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل المقطع الجاهز (MP4)</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Controls Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-sm">
            
            {/* 1. Layout Preset Selection */}
            <div>
              <label className="block text-xs font-bold text-gray-200 mb-2.5 flex items-center gap-1.5">
                <Layout className="w-4 h-4 text-indigo-400" />
                <span>نمط المونتاج وتوزيع الشاشة (Layout Preset):</span>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLayout('split_screen')}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    layout === 'split_screen'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-indigo-300 mb-1">🎮 انقسام الستريمر (الأشهر)</div>
                  <div className="text-[10px] text-gray-400">وجه الستريمر بالأعلى والشاشة واللعبة بالأسفل</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('blur_background')}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    layout === 'blur_background'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-purple-300 mb-1">🎬 خلفية سينمائية مموهة</div>
                  <div className="text-[10px] text-gray-400">شاشة الستريم بالوسط مع تمويه فخم للأطراف</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('face_track')}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    layout === 'face_track'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-emerald-300 mb-1">👤 تتبع الوجه الذكي (9:16)</div>
                  <div className="text-[10px] text-gray-400">قص رأسي ذكي يتبع المتحدث باستمرار</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout('custom_sample')}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    layout === 'custom_sample'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-amber-300 mb-1">✨ نمط مخصص (Custom Sample)</div>
                  <div className="text-[10px] text-gray-400">استخدام إحداثيات أو قالب عينة مخصص</div>
                </button>
              </div>
            </div>

            {/* 2. Facecam Quadrant Picker & AI Auto-Detection */}
            {layout === 'split_screen' && (
              <div className="p-4 rounded-xl bg-stream-dark/70 border border-stream-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-xs text-gray-200">مكان كاميرا الستريمر في الستريم:</span>
                  </div>

                  {/* AI Auto-Detect Button */}
                  <button
                    type="button"
                    onClick={handleAutoDetectCamera}
                    disabled={isDetectingCam}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold transition-all disabled:opacity-50"
                  >
                    <Scan className={`w-3.5 h-3.5 ${isDetectingCam ? 'animate-spin' : ''}`} />
                    <span>{isDetectingCam ? 'جاري الفحص بالذكاء الاصطناعي...' : 'كشف ذكي وتلقائي لمكان الكاميرا'}</span>
                  </button>
                </div>

                {detectSuccessMsg && (
                  <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{detectSuccessMsg}</span>
                  </div>
                )}

                {/* 6 Quadrant Presets */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs">
                  {Object.entries(quadrantCoordinates).map(([id, info]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectQuadrant(id)}
                      className={`py-2 px-1.5 rounded-lg border text-center font-bold text-[10px] sm:text-[11px] transition-all flex flex-col items-center justify-center gap-0.5 ${
                        faceQuadrant === id
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-stream-card border-stream-border text-gray-400 hover:text-white hover:border-gray-600'
                      }`}
                    >
                      <span>{info.label.split(' ')[0]}</span>
                      <span className="text-[9px] opacity-80">{info.label.split(' ').slice(1).join(' ')}</span>
                    </button>
                  ))}
                </div>

                {/* Live Coordinates Summary */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 bg-black/40 px-3 py-1.5 rounded-lg border border-stream-border/50 font-mono">
                  <span>منطقة القص المحددة للكاميرا:</span>
                  <span className="text-indigo-300">
                    X: {Math.round(customFaceBox.x * 100)}% | Y: {Math.round(customFaceBox.y * 100)}% | W: {Math.round(customFaceBox.w * 100)}% | H: {Math.round(customFaceBox.h * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* 3. Animated Captions Style Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-200 mb-2.5 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-emerald-400" />
                <span>نمط الترجمة المتحركة (Animated Captions):</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'hormozi', name: '🔥 Hormozi Pop', desc: 'خط عريض وكلمة صفراء لامعة' },
                  { id: 'neon', name: '⚡ Neon Gamer', desc: 'إضاءة نيون فوشي وسماوي' },
                  { id: 'karaoke', name: '🎤 Karaoke Wave', desc: 'تلوين متتابع وتأثير ناعم' },
                  { id: 'minimal', name: '⚪ Sleek Minimal', desc: 'نصوص عصرية بدون مبالغة' },
                  { id: 'none', name: '🚫 بدون ترجمة', desc: 'إخراج الفيديو بدون نصوص' },
                ].map((cap) => (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => setCaptionStyle(cap.id)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      captionStyle === cap.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">{cap.name}</div>
                    <div className="text-[10px] text-gray-400">{cap.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Timeline Range & Fine-tuning */}
            <div className="p-3.5 rounded-xl bg-stream-dark/70 border border-stream-border space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-200">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>توقيت أخذ الكليب من الستريم:</span>
                </span>
                <span className="text-amber-400 font-mono">المدة: {duration} ثانية</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">وقت البداية (ثانية):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={startTime}
                    onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg bg-stream-card border border-stream-border text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">وقت النهاية (ثانية):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={endTime}
                    onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg bg-stream-card border border-stream-border text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. Render Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRender}
                disabled={rendering}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-stream-twitch via-stream-accent to-emerald-500 hover:opacity-95 text-white font-black text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {rendering ? 'جاري مونتاج ورندرة الكليب عبر FFmpeg...' : 'مونتاج وتصدير الكليب النهائي (Render 9:16 Short)'}
                </span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
