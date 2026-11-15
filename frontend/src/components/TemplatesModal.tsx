import React, { useState, useRef, useEffect } from 'react';
import { X, Layout, UploadCloud, Sparkles } from 'lucide-react';
import { LayoutTemplate } from '../types';
import { api } from '../api/client';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: LayoutTemplate[];
  onTemplatesUpdated: (updated: LayoutTemplate[]) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  onTemplatesUpdated,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sampleName, setSampleName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      onClose();
    }
  };

  const handleUploadSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      await api.uploadSampleTemplate(selectedFile, sampleName.trim() || 'Custom Edit Sample');
      const refreshed = await api.listTemplates();
      onTemplatesUpdated(refreshed);
      setSelectedFile(null);
      setSampleName('');
      alert('تم رفع قالب العينة وحفظه بنجاح!');
    } catch (err: any) {
      alert(`فشل رفع العينة: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleDialogClick}
      aria-labelledby="templates-modal-title"
      className="p-4"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-stream-card border border-stream-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 border-b border-stream-border bg-stream-dark/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h2 id="templates-modal-title" className="text-lg font-bold text-white">
                مكتبة أنماط المونتاج ونماذج الـ Edits
              </h2>
              <p className="text-xs text-gray-400">
                اختر من قوالب المونتاج الجاهزة أو ارفع Sample لنمط إيديت مخصص
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-stream-border/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Existing Templates Grid */}
          <div>
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider mb-3">
              أنماط المونتاج المتوفرة:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl bg-stream-dark border border-stream-border hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <Layout className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-xs">{tpl.name}</h4>
                        {tpl.is_default && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                            افتراضي
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stream-border/60 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-mono">نوع التوزيع: {tpl.layout_type}</span>
                    <span className="text-emerald-400 font-semibold">جاهز للاستخدام</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload New Sample Section */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 to-purple-950/20 border border-indigo-500/30">
            <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>رفع Sample جديد أو إطار مخصص (Upload Edit Sample):</span>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">
              يمكنك رفع لقطة شاشة لنمط المونتاج أو الـ Overlay المفضل لديك لإنشاء نمط مونتاج جديد مخصص.
            </p>

            <form onSubmit={handleUploadSample} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="اسم النمط (مثال: نمط كاميرا دائرية أعلى اليمين)..."
                  value={sampleName}
                  onChange={(e) => setSampleName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-stream-dark border border-stream-border text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="sample-file-input"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('sample-file-input')?.click()}
                  className="px-4 py-2 rounded-xl bg-stream-card hover:bg-stream-border text-xs font-semibold text-gray-200 border border-stream-border transition-colors flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4 text-indigo-400" />
                  <span>{selectedFile ? selectedFile.name : 'اختر صورة الـ Sample'}</span>
                </button>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40"
                >
                  {uploading ? 'جاري الحفظ...' : 'حفظ كنمط جديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </dialog>
  );
};
