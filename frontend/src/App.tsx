import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Layers, RefreshCw, Flame, Clock, 
  ExternalLink, Sliders, CheckCircle2, AlertCircle, PlusCircle, Scissors, Share2
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StreamIngest } from './components/StreamIngest';
import { ProcessingState } from './components/ProcessingState';
import { ClipCard } from './components/ClipCard';
import { ClipStudioModal } from './components/ClipStudioModal';
import { OpenCutEditorModal } from './components/OpenCutEditorModal';
import { AutoClipPublishModal } from './components/AutoClipPublishModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { TemplatesModal } from './components/TemplatesModal';
import { Project, ClipItem, AppSettings, LayoutTemplate } from './types';
import { api } from './api/client';

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [selectedStudioClip, setSelectedStudioClip] = useState<ClipItem | null>(null);
  const [selectedOpenCutClip, setSelectedOpenCutClip] = useState<ClipItem | null>(null);
  const [selectedAutoClip, setSelectedAutoClip] = useState<ClipItem | null>(null);
  const [previewClip, setPreviewClip] = useState<ClipItem | null>(null);

  // Loading & Ingest states
  const [isIngesting, setIsIngesting] = useState(false);
  const [renderingClipId, setRenderingClipId] = useState<string | null>(null);

  // Load initial settings and templates
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [s, t, p] = await Promise.all([
        api.getSettings().catch(() => null),
        api.listTemplates().catch(() => []),
        api.listProjects().catch(() => []),
      ]);
      if (s) setSettings(s);
      if (t) setTemplates(t);
      if (p) {
        setRecentProjects(p);
        if (p.length > 0 && !currentProject) {
          // Pick the most relevant project: ready first, then active in-progress
          const activeOrReady = p.find((proj: Project) => proj.status === 'ready') || p[0];
          setCurrentProject(activeOrReady);
        }
      }
    } catch (e) {
      console.error('Initial load error:', e);
    }
  };

  // Poll project progress if in progress or downloading
  useEffect(() => {
    if (!currentProject) return;
    if (currentProject.status !== 'ready' && currentProject.status !== 'error') {
      const interval = setInterval(async () => {
        try {
          const updated = await api.getProject(currentProject.id);
          setCurrentProject(updated);

          if (updated.status === 'downloaded') {
            await api.processProject(
              updated.id,
              settings?.active_ai_provider,
              undefined,
              6
            );
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [currentProject?.id, currentProject?.status, settings?.active_ai_provider]);

  // Handle URL Stream Ingest
  const handleStartIngestUrl = async (url: string) => {
    setIsIngesting(true);
    try {
      const res = await api.ingestStream(url, 60);
      setCurrentProject(res.project);
    } catch (err: any) {
      alert(`فشل بدء العملية: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Video File Upload
  const handleUploadFile = async (file: File) => {
    setIsIngesting(true);
    try {
      const res = await api.uploadVideo(file);
      setCurrentProject(res.project);

      await api.processProject(
        res.project.id,
        settings?.active_ai_provider,
        undefined,
        6
      );
    } catch (err: any) {
      alert(`فشل رفع الفيديو: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  // Quick Render Clip
  const handleQuickRender = async (clip: ClipItem) => {
    if (!currentProject) return;
    setRenderingClipId(clip.id);
    try {
      const activeFaceBox = clip.face_box || currentProject.facecam_info;
      const res = await api.renderClip({
        project_id: currentProject.id,
        clip_id: clip.id,
        start_time: clip.start_time,
        end_time: clip.end_time,
        layout: 'split_screen',
        caption_style: 'hormozi',
        face_box: activeFaceBox,
      });

      const updatedClips = (currentProject.clips || []).map((c) =>
        c.id === clip.id
          ? {
              ...c,
              rendered_url: res.download_url,
              rendered_file: res.filename,
              selected_layout: 'split_screen',
              selected_caption_style: 'hormozi',
            }
          : c
      );
      setCurrentProject({ ...currentProject, clips: updatedClips });
    } catch (err: any) {
      alert(`فشل الرندرة: ${err.message}`);
    } finally {
      setRenderingClipId(null);
    }
  };

  const handleClipUpdated = (updatedClip: ClipItem) => {
    if (!currentProject) return;
    const updatedClips = (currentProject.clips || []).map((c) =>
      c.id === updatedClip.id ? updatedClip : c
    );
    setCurrentProject({ ...currentProject, clips: updatedClips });
  };

  return (
    <div className="min-h-screen bg-stream-dark text-white flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onNewProject={() => setCurrentProject(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* If no active project or user wants to start fresh */}
        {!currentProject && (
          <div className="py-6">
            <StreamIngest
              onStartIngestUrl={handleStartIngestUrl}
              onUploadFile={handleUploadFile}
              loading={isIngesting}
            />

            {/* Recent Projects Shelf */}
            {recentProjects.length > 0 && (
              <div className="mt-16 max-w-4xl mx-auto" dir="rtl">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>المشاريع والستريمات السابقة:</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentProjects.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setCurrentProject(p)}
                      className="p-4 rounded-xl bg-stream-card border border-stream-border hover:border-indigo-500/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {p.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="capitalize">{p.source_type}</span>
                          <span>•</span>
                          <span>{p.clips?.length || 0} كلبسات</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          p.status === 'ready'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        {p.status === 'ready' ? 'مكتمل' : p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* If Project is in Progress (Downloading, Transcribing, Analyzing) */}
        {currentProject && currentProject.status !== 'ready' && (
          <div>
            <ProcessingState 
              project={currentProject} 
              onRetry={async () => {
                try {
                  if (currentProject.video_path) {
                    await api.processProject(
                      currentProject.id,
                      settings?.active_ai_provider,
                      undefined,
                      6
                    );
                    const updated = await api.getProject(currentProject.id);
                    setCurrentProject(updated);
                  } else if (currentProject.source_url) {
                    handleStartIngestUrl(currentProject.source_url);
                  }
                } catch (e: any) {
                  alert(`فشل إعادة المحاولة: ${e.message}`);
                }
              }}
              onNewStream={() => setCurrentProject(null)}
            />
          </div>
        )}

        {/* If Project is Ready with Clips! */}
        {currentProject && currentProject.status === 'ready' && (
          <div className="space-y-8" dir="rtl">
            
            {/* Project Header Banner */}
            <div className="bg-stream-card border border-stream-border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم تحليل الستريم بنجاح</span>
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {currentProject.clips?.length || 0} لقطات مستخرجة
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {currentProject.title}
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  المصدر: <span className="text-indigo-400 font-mono">{currentProject.source_url || 'ملف مرفوع'}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentProject(null)}
                  className="px-4 py-2 rounded-xl bg-stream-dark hover:bg-stream-border text-xs font-bold text-gray-300 hover:text-white border border-stream-border transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>ستريم جديد</span>
                </button>
              </div>
            </div>

            {/* Clips Grid Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>الكلبسات الأكثر فيروسية (Viral Clips Candidates):</span>
                </h2>
                <p className="text-xs text-gray-400">
                  مرتبة حسب درجة الفيروسية • يمكنك المونتاج الفوري، التعديل اليدوي في OpenCut، أو نسخ حزمة النشر
                </p>
              </div>
            </div>

            {/* Clips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(currentProject.clips || []).map((clip, idx) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  index={idx}
                  onOpenStudio={(c) => setSelectedStudioClip(c)}
                  onOpenOpenCut={(c) => setSelectedOpenCutClip(c)}
                  onOpenAutoClip={(c) => setSelectedAutoClip(c)}
                  onQuickRender={handleQuickRender}
                  onWatchVideo={(c) => setPreviewClip(c)}
                  isRendering={renderingClipId === clip.id}
                />
              ))}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-stream-border/80 bg-stream-dark/60 py-6 text-center text-xs text-gray-500">
        <p>StreamClip Studio AI • منصة احترافية لمونتاج كلبسات البث المباشر (Twitch, Kick, YouTube) مع محرر OpenCut وVideo-Use وAutoClip</p>
      </footer>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaved={(s) => setSettings(s)}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        templates={templates}
        onTemplatesUpdated={(t) => setTemplates(t)}
      />

      {/* Preset & Layout Studio Modal */}
      {selectedStudioClip && currentProject && (
        <ClipStudioModal
          isOpen={Boolean(selectedStudioClip)}
          clip={selectedStudioClip}
          project={currentProject}
          onClose={() => setSelectedStudioClip(null)}
          onClipUpdated={handleClipUpdated}
        />
      )}

      {/* OpenCut Manual Timeline Video Editor Modal */}
      {selectedOpenCutClip && currentProject && (
        <OpenCutEditorModal
          isOpen={Boolean(selectedOpenCutClip)}
          clip={selectedOpenCutClip}
          project={currentProject}
          onClose={() => setSelectedOpenCutClip(null)}
          onClipUpdated={handleClipUpdated}
        />
      )}

      {/* AutoClip Multi-Platform Packaging Modal */}
      {selectedAutoClip && currentProject && (
        <AutoClipPublishModal
          isOpen={Boolean(selectedAutoClip)}
          clip={selectedAutoClip}
          project={currentProject}
          onClose={() => setSelectedAutoClip(null)}
        />
      )}

      {/* Fullscreen Video Player Modal */}
      {previewClip && (
        <VideoPlayerModal
          isOpen={Boolean(previewClip)}
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
          onOpenOpenCut={(c) => {
            setPreviewClip(null);
            setSelectedOpenCutClip(c);
          }}
        />
      )}
    </div>
  );
}

export default App;
