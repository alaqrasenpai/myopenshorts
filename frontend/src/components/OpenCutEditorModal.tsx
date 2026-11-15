import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Pause, Scissors, Trash2, Volume2, VolumeX, Sparkles, 
  Download, Clock, Sliders, Type, FastForward, Undo, CheckCircle2,
  Wand2, RefreshCw, Layers, ShieldCheck, Film, CornerDownLeft,
  Maximize2, RotateCcw, Plus, ChevronRight, ChevronLeft, Video
} from 'lucide-react';
import { ClipItem, Project } from '../types';
import { api, OpenCutSegment } from '../api/client';

interface OpenCutEditorModalProps {
  clip: ClipItem | null;
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onClipUpdated: (updated: ClipItem) => void;
}

export const OpenCutEditorModal: React.FC<OpenCutEditorModalProps> = ({
  clip,
  project,
  isOpen,
  onClose,
  onClipUpdated,
}) => {
  if (!isOpen || !clip) return null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clipDuration = Math.max(1, clip.duration || (clip.end_time - clip.start_time));

  // Timeline segments in relative time (0.0 to clipDuration)
  const [segments, setSegments] = useState<OpenCutSegment[]>([
    { start: 0, end: clipDuration, speed: 1.0 }
  ]);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number>(0);

  // Playhead states (relative time 0 to clipDuration)
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.0);

  // Settings & visual filters
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [colorGrade, setColorGrade] = useState<string>('none');
  const [microfades, setMicrofades] = useState<boolean>(true); // video-use 30ms audio microfade
  
  // Text Overlay management
  const [textOverlays, setTextOverlays] = useState<Array<{ text: string; position: 'top' | 'center' | 'bottom'; color: string }>>([]);
  const [newText, setNewText] = useState<string>('');
  const [newTextPos, setNewTextPos] = useState<'top' | 'center' | 'bottom'>('top');
  const [newTextColor, setNewTextColor] = useState<string>('#f59e0b');

  // Video-Use Agentic instruction bar
  const [agentPrompt, setAgentPrompt] = useState<string>('');
  const [isAgentExecuting, setIsAgentExecuting] = useState<boolean>(false);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);

  // Silence detection
  const [isDetectingSilence, setIsDetectingSilence] = useState<boolean>(false);
  const [detectedSilencesCount, setDetectedSilencesCount] = useState<number | null>(null);

  // Render & export state
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(clip.rendered_url || null);
  const [renderedFilename, setRenderedFilename] = useState<string | null>(clip.rendered_file || null);

  // Video source URL: FastStart snippet endpoint for instant streaming
  const videoSrc = `/api/clips/snippet/${project.id}/${clip.id}`;

  // Total edited net duration
  const totalDuration = segments.reduce((acc, seg) => acc + (seg.end - seg.start) / (seg.speed || 1.0), 0);

  // Video Timeupdate listener
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const vTime = videoRef.current.currentTime;
    setCurrentTime(vTime);

    // If reached end of active segment or clip, pause or loop
    if (vTime >= clipDuration) {
      setIsPlaying(false);
      videoRef.current.pause();
    }
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

  const seekToRelativeTime = (timeInSeconds: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(clipDuration, timeInSeconds));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  // ✂️ Split active segment at current playhead
  const handleSplitAtPlayhead = () => {
    const cur = currentTime;
    const targetIdx = segments.findIndex((s) => cur > s.start + 0.3 && cur < s.end - 0.3);
    if (targetIdx === -1) {
      alert('يجب وضع مؤشر التايم لاين داخل مقطع لإجراء القص (Split)');
      return;
    }

    const seg = segments[targetIdx];
    const newSeg1: OpenCutSegment = { start: seg.start, end: cur, speed: seg.speed };
    const newSeg2: OpenCutSegment = { start: cur, end: seg.end, speed: seg.speed };

    const newSegments = [...segments];
    newSegments.splice(targetIdx, 1, newSeg1, newSeg2);
    setSegments(newSegments);
    setSelectedSegmentIdx(targetIdx + 1);
  };

  // 🗑️ Delete selected segment
  const handleDeleteSelectedSegment = () => {
    if (segments.length <= 1) {
      alert('لا يمكنك حذف المقطع الوحيد في التايم لاين');
      return;
    }
    const newSegments = segments.filter((_, idx) => idx !== selectedSegmentIdx);
    setSegments(newSegments);
    const nextIdx = Math.max(0, selectedSegmentIdx - 1);
    setSelectedSegmentIdx(nextIdx);
    if (newSegments[nextIdx]) {
      seekToRelativeTime(newSegments[nextIdx].start);
    }
  };

  // ⚡ Speed control
  const handleChangeSpeed = (speed: number) => {
    setCurrentSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    const newSegments = [...segments];
    if (newSegments[selectedSegmentIdx]) {
      newSegments[selectedSegmentIdx].speed = speed;
      setSegments(newSegments);
    }
  };

  // 📐 Trim active segment boundary
  const handleNudgeBoundary = (isStart: boolean, delta: number) => {
    const newSegments = [...segments];
    const seg = newSegments[selectedSegmentIdx];
    if (!seg) return;

    if (isStart) {
      const newStart = Math.max(0, Math.min(seg.end - 0.3, seg.start + delta));
      seg.start = Math.round(newStart * 10) / 10;
      seekToRelativeTime(seg.start);
    } else {
      const newEnd = Math.max(seg.start + 0.3, Math.min(clipDuration, seg.end + delta));
      seg.end = Math.round(newEnd * 10) / 10;
      seekToRelativeTime(seg.end);
    }
    setSegments(newSegments);
  };

  // 🔇 Remove silence pauses (Video-Use silence trim)
  const handleRemoveSilence = async () => {
    setIsDetectingSilence(true);
    try {
      const res = await api.detectSilences(project.id, clip.start_time, clip.end_time);
      const silences = res.silences || [];
      setDetectedSilencesCount(silences.length);

      if (silences.length === 0) {
        alert('لم يتم العثور على فترات صمت ملحوظة في هذا الكليب');
        return;
      }

      // Rebuild segments cutting out the silences (in relative seconds)
      const activeSegments: OpenCutSegment[] = [];
      let cursor = 0;
      for (const sil of silences) {
        const silStart = sil.start;
        const silEnd = sil.end;
        if (silStart > cursor + 0.3) {
          activeSegments.push({ start: cursor, end: silStart, speed: 1.0 });
        }
        cursor = silEnd;
      }
      if (cursor < clipDuration - 0.3) {
        activeSegments.push({ start: cursor, end: clipDuration, speed: 1.0 });
      }

      if (activeSegments.length > 0) {
        setSegments(activeSegments);
        setSelectedSegmentIdx(0);
        seekToRelativeTime(activeSegments[0].start);
      }
    } catch (e: any) {
      alert(`فشل اكتشاف فترات الصمت: ${e.message}`);
    } finally {
      setIsDetectingSilence(false);
    }
  };

  // ✍️ Add Text Overlay
  const handleAddTextOverlay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setTextOverlays([...textOverlays, { text: newText.trim(), position: newTextPos, color: newTextColor }]);
    setNewText('');
  };

  // 🤖 Video-Use Agent Natural Language Command
  const handleExecuteAgentCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentPrompt.trim()) return;

    setIsAgentExecuting(true);
    setAgentMessage(null);
    try {
      const promptLower = agentPrompt.toLowerCase();
      if (promptLower.includes('صمت') || promptLower.includes('silence')) {
        await handleRemoveSilence();
        setAgentMessage('تم فحص وقص فترات الصمت تلقائياً بنجاح');
      } else if (promptLower.includes('سرع') || promptLower.includes('1.5') || promptLower.includes('speed')) {
        handleChangeSpeed(1.5);
        setAgentMessage('تمت زيادة سرعة المقطع إلى 1.5x');
      } else if (promptLower.includes('سينمائي') || promptLower.includes('cinematic')) {
        setColorGrade('cinematic');
        setAgentMessage('تم تطبيق التدرج اللوني السينمائي');
      } else {
        const res = await api.executeAgentEdit({
          project_id: project.id,
          clip_id: clip.id,
          instruction: agentPrompt.trim(),
        });
        setAgentMessage(res.explanation);
        if (res.operations?.color_grade) setColorGrade(res.operations.color_grade);
      }
    } catch (err: any) {
      alert(`فشل تنفيذ أمر التعديل: ${err.message}`);
    } finally {
      setIsAgentExecuting(false);
    }
  };

  // 💾 Render OpenCut Manual Timeline
  const handleRenderOpenCut = async () => {
    setIsRendering(true);
    try {
      // Map relative segments to absolute stream times
      const absoluteSegments = segments.map((s) => ({
        start: clip.start_time + s.start,
        end: clip.start_time + s.end,
        speed: s.speed || 1.0,
      }));

      const res = await api.renderOpenCutManual({
        project_id: project.id,
        clip_id: clip.id,
        segments: absoluteSegments,
        text_overlays: textOverlays,
        target_aspect_ratio: aspectRatio,
        color_grade: colorGrade,
        enable_audio_microfades: microfades,
      });

      setRenderedUrl(res.download_url);
      setRenderedFilename(res.filename);
      onClipUpdated({
        ...clip,
        rendered_url: res.download_url,
        rendered_file: res.filename,
      });
      alert('تم تصدير التعديلات اليدوية بنجاح عبر OpenCut! يمكنك تنزيل أو مشاهدة المقطع الآن.');
    } catch (err: any) {
      alert(`خطأ أثناء التصدير: ${err.message}`);
    } finally {
      setIsRendering(false);
    }
  };

  // Direct Browser Download
  const handleDownload = () => {
    const url = renderedUrl || clip.rendered_url;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', renderedFilename || clip.rendered_file || 'opencut_clip.mp4');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live CSS Filter for video player
  const getFilterStyle = () => {
    switch (colorGrade) {
      case 'cinematic': return 'contrast(1.15) saturate(1.25) brightness(0.95)';
      case 'vibrant': return 'saturate(1.5) contrast(1.1)';
      case 'warm': return 'sepia(0.25) saturate(1.25)';
      case 'bw': return 'grayscale(1.0) contrast(1.2)';
      default: return 'none';
    }
  };

  const playheadPercent = Math.min(100, Math.max(0, (currentTime / clipDuration) * 100));

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-6xl bg-stream-card border border-stream-border rounded-2xl shadow-2xl flex flex-col h-[95vh] overflow-hidden"
        dir="rtl"
      >
        {/* Top Navbar */}
        <div className="px-5 py-3 border-b border-stream-border bg-stream-dark/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">محرر التايم لاين اليدوي (OpenCut Pro Editor)</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  CapCut-style Timeline
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-1">{clip.hook_title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(renderedUrl || clip.rendered_url) && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل المقطع المعدل (MP4)</span>
              </button>
            )}

            <button
              onClick={handleRenderOpenCut}
              disabled={isRendering}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRendering ? 'جاري تصدير التعديلات...' : 'تصدير التعديلات (Export)'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-stream-border/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace: Top Video Player & Settings, Bottom Multi-Track Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden bg-stream-dark">
          
          {/* Top Half: Real Video Player + AI Tools + Overlays (Grid) */}
          <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden border-b border-stream-border">
            
            {/* Player Preview Box (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center bg-black rounded-xl border border-stream-border/80 p-2 relative overflow-hidden shadow-inner">
              
              {/* Responsive Video Container with CSS Filter */}
              <div 
                className={`relative bg-black rounded-lg overflow-hidden border border-white/10 flex items-center justify-center group ${
                  aspectRatio === '9:16' ? 'w-[195px] h-[346px]' : aspectRatio === '1:1' ? 'w-[280px] h-[280px]' : 'w-[360px] h-[202px]'
                }`}
              >
                <video
                  ref={videoRef}
                  src={videoSrc}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onClick={togglePlay}
                  style={{ filter: getFilterStyle() }}
                  className="w-full h-full object-contain cursor-pointer"
                />

                {/* Big Center Play Icon if Paused */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-xl backdrop-blur-sm transition-transform hover:scale-110 z-20"
                  >
                    <Play className="w-6 h-6 ml-0.5" />
                  </button>
                )}

                {/* Live Text Overlays on Video Screen */}
                {textOverlays.map((to, i) => (
                  <div
                    key={i}
                    className={`absolute inset-x-2 text-center pointer-events-none z-10 font-black text-sm uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,1)] ${
                      to.position === 'top' ? 'top-4' : to.position === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-6'
                    }`}
                    style={{ color: to.color }}
                  >
                    <span className="bg-black/60 px-2 py-0.5 rounded border border-white/20">
                      {to.text}
                    </span>
                  </div>
                ))}

                {/* Badges Overlay */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 pointer-events-none">
                  {microfades && (
                    <span className="text-[8px] font-mono text-emerald-400 bg-black/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      30ms Anti-Pop
                    </span>
                  )}
                  {currentSpeed !== 1.0 && (
                    <span className="text-[8px] font-mono text-amber-400 bg-black/70 px-1.5 py-0.5 rounded border border-amber-500/30">
                      {currentSpeed}x
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1 rounded bg-black/70 text-white hover:text-indigo-400"
                    title={isMuted ? 'إلغاء الكتم' : 'كتم'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Timecode & Status Bar */}
              <div className="mt-2 flex items-center gap-3 text-xs font-mono text-gray-300">
                <span className="text-indigo-400 font-bold">{formatSec(currentTime)}</span>
                <span>/</span>
                <span className="text-gray-400">{formatSec(clipDuration)}</span>
                <span className="text-amber-400 font-semibold">({totalDuration.toFixed(1)}s بعد القص)</span>
              </div>
            </div>

            {/* Right Tools & Settings (7 cols) */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-3 overflow-y-auto pr-1 text-xs">
              
              {/* 1. Video-Use Natural Language AI Command Bar */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-stream-card border border-indigo-500/30 shadow-md">
                <div className="flex items-center gap-2 text-indigo-300 font-bold mb-1.5">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <span>تعديل بالأوامر الذكية (Video-Use AI Agent):</span>
                </div>
                <form onSubmit={handleExecuteAgentCommand} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="اكتب أمر التعديل، مثال: احذف الصمت، طبق فلتر سينمائي، سرع المقطع 1.5x..."
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-stream-dark border border-stream-border text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isAgentExecuting || !agentPrompt.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <CornerDownLeft className="w-3 h-3" />
                    <span>{isAgentExecuting ? 'جاري التطبيق...' : 'تطبيق'}</span>
                  </button>
                </form>

                {agentMessage && (
                  <div className="mt-2 text-[11px] text-emerald-300 flex items-center gap-1.5 bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span>{agentMessage}</span>
                  </div>
                )}
              </div>

              {/* 2. Controls Grid: Speed & Color Grade */}
              <div className="grid grid-cols-2 gap-3">
                {/* Speed Controls */}
                <div className="p-2.5 rounded-xl bg-stream-card border border-stream-border">
                  <label className="text-[11px] font-bold text-gray-300 block mb-1.5">
                    سرعة المقطع المحدد (Playback Speed):
                  </label>
                  <div className="grid grid-cols-5 gap-1 text-[11px] font-mono">
                    {[0.5, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => handleChangeSpeed(spd)}
                        className={`py-1 rounded font-bold border transition-all ${
                          currentSpeed === spd
                            ? 'bg-amber-600 border-amber-500 text-white shadow'
                            : 'bg-stream-dark border-stream-border text-gray-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Grading */}
                <div className="p-2.5 rounded-xl bg-stream-card border border-stream-border">
                  <label className="text-[11px] font-bold text-gray-300 block mb-1.5">
                    الفلتر اللوني (Color Grading):
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-[11px]">
                    {[
                      { id: 'none', label: 'طبيعي' },
                      { id: 'cinematic', label: 'سينمائي' },
                      { id: 'vibrant', label: 'حيوي' },
                      { id: 'bw', label: 'أبيض/أسود' },
                    ].map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setColorGrade(col.id)}
                        className={`py-1 rounded font-semibold text-center border transition-all ${
                          colorGrade === col.id
                            ? 'bg-purple-600 border-purple-500 text-white shadow'
                            : 'bg-stream-dark border-stream-border text-gray-400 hover:text-white'
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Segment Trim & Nudge Controls */}
              <div className="p-2.5 rounded-xl bg-stream-card border border-stream-border flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-gray-300">
                  ضبط أطراف المقطع #{selectedSegmentIdx + 1}:
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => handleNudgeBoundary(true, -0.5)}
                    className="px-2 py-1 rounded bg-stream-dark border border-stream-border hover:bg-stream-border text-gray-200"
                  >
                    بداية -0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNudgeBoundary(true, 0.5)}
                    className="px-2 py-1 rounded bg-stream-dark border border-stream-border hover:bg-stream-border text-gray-200"
                  >
                    بداية +0.5s
                  </button>
                  <span className="text-gray-500">|</span>
                  <button
                    type="button"
                    onClick={() => handleNudgeBoundary(false, -0.5)}
                    className="px-2 py-1 rounded bg-stream-dark border border-stream-border hover:bg-stream-border text-gray-200"
                  >
                    نهاية -0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNudgeBoundary(false, 0.5)}
                    className="px-2 py-1 rounded bg-stream-dark border border-stream-border hover:bg-stream-border text-gray-200"
                  >
                    نهاية +0.5s
                  </button>
                </div>
              </div>

              {/* 4. Text Overlay Creator */}
              <div className="p-2.5 rounded-xl bg-stream-card border border-stream-border space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-emerald-400" />
                    <span>إضافة نصوص وعناوين على الفيديو (Text Overlay):</span>
                  </div>
                  {textOverlays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTextOverlays([])}
                      className="text-rose-400 hover:text-rose-300 text-[10px]"
                    >
                      مسح الكل
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddTextOverlay} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="اكتب نصاً، مثال: لقطة جنونية! 🔥"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-stream-dark border border-stream-border text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newTextPos}
                    onChange={(e: any) => setNewTextPos(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-stream-dark border border-stream-border text-white text-[11px]"
                  >
                    <option value="top">بالأعلى</option>
                    <option value="center">بالوسط</option>
                    <option value="bottom">بالأسفل</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة</span>
                  </button>
                </form>
              </div>

              {/* 5. Power Tools: Silence Removal & Micro-fades */}
              <div className="p-2.5 rounded-xl bg-stream-card border border-stream-border flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleRemoveSilence}
                  disabled={isDetectingSilence}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>{isDetectingSilence ? 'جاري فحص الصمت...' : 'حذف فترات الصمت تلقائياً'}</span>
                </button>

                {detectedSilencesCount !== null && (
                  <span className="text-[10px] text-gray-400">
                    تم العثور على {detectedSilencesCount} فترات صمت وقصها
                  </span>
                )}

                <label className="flex items-center gap-2 cursor-pointer text-gray-300 select-none">
                  <input
                    type="checkbox"
                    checked={microfades}
                    onChange={(e) => setMicrofades(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 bg-stream-dark border-stream-border"
                  />
                  <span className="text-[11px] font-semibold">تنعيم صوتي 30ms (منع طقطقة القص)</span>
                </label>
              </div>

            </div>

          </div>

          {/* Bottom Half: OpenCut Multi-Track Timeline */}
          <div className="h-64 bg-stream-card p-3 sm:p-4 flex flex-col justify-between select-none">
            
            {/* Timeline Toolbar */}
            <div className="flex items-center justify-between pb-2 border-b border-stream-border/80">
              <div className="flex items-center gap-2">
                {/* Play / Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                  title="تشغيل / إيقاف"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                {/* Split Tool (Scissors) */}
                <button
                  type="button"
                  onClick={handleSplitAtPlayhead}
                  className="px-3 py-1.5 rounded-lg bg-stream-dark hover:bg-stream-border text-white text-xs font-bold border border-stream-border flex items-center gap-1.5 transition-colors"
                  title="قص عند موضع المؤشر الحالي"
                >
                  <Scissors className="w-3.5 h-3.5 text-indigo-400" />
                  <span>قص المقطع (Split)</span>
                </button>

                {/* Delete Segment */}
                <button
                  type="button"
                  onClick={handleDeleteSelectedSegment}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center gap-1.5 transition-colors"
                  title="حذف الجزء المحدد"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>حذف الجزء</span>
                </button>

                {/* Jump to Beginning */}
                <button
                  type="button"
                  onClick={() => seekToRelativeTime(0)}
                  className="p-1.5 rounded-lg bg-stream-dark hover:bg-stream-border text-gray-300 border border-stream-border"
                  title="إعادة المؤشر للبداية"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Segment info */}
              <div className="text-xs text-gray-400 font-mono">
                المقاطع النشطة: <span className="text-indigo-400 font-bold">{segments.length}</span> | المحدد: رقم #{selectedSegmentIdx + 1}
              </div>
            </div>

            {/* Visual Timeline Tracks Container with Playhead Scrubber */}
            <div 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                // In RTL, left is 100%, right is 0%
                const ratio = 1 - (clickX / rect.width);
                const targetTime = ratio * clipDuration;
                seekToRelativeTime(targetTime);
              }}
              className="flex-1 my-2 overflow-x-auto overflow-y-hidden relative bg-stream-dark/90 rounded-xl p-2 border border-stream-border/80 flex flex-col gap-1 cursor-pointer"
            >
              
              {/* Playhead Red Needle Marker */}
              <div 
                style={{ right: `${playheadPercent}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-all duration-75 flex flex-col items-center"
              >
                <div className="w-3 h-3 bg-rose-500 rounded-full -mt-1 shadow-md shadow-rose-500/50"></div>
              </div>

              {/* Track 1: Timecode Ruler */}
              <div className="h-4 flex items-center justify-between text-[9px] text-gray-500 font-mono px-2 border-b border-stream-border/30">
                <span>00:00.0</span>
                <span>{formatSec(clipDuration / 2)}</span>
                <span>{formatSec(clipDuration)}</span>
              </div>

              {/* Track 2: Video Slices Track */}
              <div className="h-12 bg-indigo-950/30 rounded-lg p-1 flex items-center gap-1.5 relative border border-indigo-500/20">
                <span className="absolute right-2 top-0.5 text-[8px] font-bold text-indigo-400 uppercase tracking-widest pointer-events-none z-10">
                  VIDEO TRACK
                </span>

                {segments.map((seg, idx) => {
                  const segDuration = seg.end - seg.start;
                  const widthPercent = Math.max(5, (segDuration / clipDuration) * 100);

                  return (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSegmentIdx(idx);
                        seekToRelativeTime(seg.start);
                      }}
                      style={{ width: `${widthPercent}%` }}
                      className={`h-full rounded-md p-1.5 cursor-pointer transition-all flex flex-col justify-between border ${
                        selectedSegmentIdx === idx
                          ? 'bg-indigo-600/50 border-indigo-400 shadow-md ring-1 ring-indigo-400'
                          : 'bg-stream-card hover:bg-stream-border border-stream-border text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono text-white/90">
                        <span>#{idx + 1}</span>
                        <span>{segDuration.toFixed(1)}s</span>
                      </div>
                      <div className="text-[8px] text-gray-400 truncate font-mono">
                        {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Track 3: Audio Waveform Track */}
              <div className="h-8 bg-emerald-950/20 rounded-lg p-1 flex items-center relative border border-emerald-500/20 overflow-hidden">
                <span className="absolute right-2 top-0.5 text-[8px] font-bold text-emerald-400 uppercase tracking-widest pointer-events-none z-10">
                  AUDIO WAVEFORM
                </span>
                <div className="w-full h-full flex items-center justify-around opacity-70">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      style={{ height: `${Math.abs(Math.sin(i * 0.35)) * 60 + 20}%` }}
                      className="w-1 bg-emerald-400/80 rounded-full"
                    ></div>
                  ))}
                </div>
              </div>

              {/* Track 4: Text Overlays Track if any */}
              {textOverlays.length > 0 && (
                <div className="h-6 bg-amber-950/20 rounded-lg px-2 flex items-center gap-2 border border-amber-500/20 text-[9px] text-amber-300">
                  <span className="font-bold">TEXT TRACK:</span>
                  {textOverlays.map((to, i) => (
                    <span key={i} className="bg-black/50 px-1.5 py-0.5 rounded border border-amber-500/30">
                      "{to.text}" ({to.position})
                    </span>
                  ))}
                </div>
              )}

            </div>

            {/* Bottom Scrubber Handle Bar */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
              <span>اضغط على أي نقطة في التايم لاين لتحريك الفيديو، أو استخدم المقص (Split) لتقطيع الأجزاء</span>
              <span className="text-pink-400 font-mono font-semibold">OpenCut Pro + Video-Use Core</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
