import React, { useState } from 'react';
import { X, Key, CheckCircle2, AlertCircle, Sparkles, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { AppSettings } from '../types';
import { api } from '../api/client';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onSaved: (updated: AppSettings) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'gemini' | 'openai' | 'groq'>(
    settings?.active_ai_provider || 'gemini'
  );

  const [geminiKey, setGeminiKey] = useState(settings?.gemini_api_key || '');
  const [openaiKey, setOpenaiKey] = useState(settings?.openai_api_key || '');
  const [groqKey, setGroqKey] = useState(settings?.groq_api_key || '');
  const [whisperProvider, setWhisperProvider] = useState(settings?.whisper_provider || 'local');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let keyToTest = '';
      if (activeTab === 'gemini') keyToTest = geminiKey;
      else if (activeTab === 'openai') keyToTest = openaiKey;
      else if (activeTab === 'groq') keyToTest = groqKey;

      if (!keyToTest.trim()) {
        setTestResult({ success: false, message: 'يرجى إدخال الـ API Key أولاً لاختباره' });
        setTesting(false);
        return;
      }

      const res = await api.testApiKey(activeTab, keyToTest);
      setTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'فشل التحقق من المفتاح' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<AppSettings> = {
        active_ai_provider: activeTab,
        gemini_api_key: geminiKey,
        openai_api_key: openaiKey,
        groq_api_key: groqKey,
        whisper_provider: whisperProvider as any,
      };

      // Also persist in localStorage for multi-user client independence
      localStorage.setItem('streamclip_user_key', JSON.stringify(payload));

      const updated = await api.updateSettings(payload);
      onSaved(updated.settings);
      onClose();
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-stream-card border border-stream-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-6 border-b border-stream-border flex items-center justify-between bg-stream-dark/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إعداد مفاتيح الذكاء الاصطناعي (BYO AI Key)</h2>
              <p className="text-xs text-gray-400">
                يمكن لكل مستخدم استخدام حساب الـ AI الخاص به لمعالجة واكتشاف اللقطات الفيروسية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-stream-border/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              اختر مزود الذكاء الاصطناعي الأساسي لتحليل الفيديو:
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => { setActiveTab('gemini'); setTestResult(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  activeTab === 'gemini'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-gray-200 hover:bg-stream-dark'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  Google Gemini
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">سريع جداً + مجاني/كبير</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('openai'); setTestResult(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  activeTab === 'openai'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                    : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-gray-200 hover:bg-stream-dark'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  OpenAI
                </div>
                <span className="text-[10px] text-gray-400">GPT-4o / GPT-4o-mini</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('groq'); setTestResult(null); }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                  activeTab === 'groq'
                    ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                    : 'border-stream-border bg-stream-dark/40 text-gray-400 hover:text-gray-200 hover:bg-stream-dark'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-amber-400">
                  <Zap className="w-4 h-4" />
                  Groq Cloud
                </div>
                <span className="text-[10px] text-gray-400">LLaMA 3.3 + Fast Whisper</span>
              </button>
            </div>
          </div>

          {/* Key Input Section */}
          <div className="space-y-4">
            {activeTab === 'gemini' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-200">
                    Google Gemini API Key:
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    الحصول على مفتاح مجاني من Google AI Studio
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stream-dark border border-stream-border text-white text-sm focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                />
                <p className="text-[11px] text-gray-400">
                  يستخدم موديل <code className="text-indigo-300">gemini-3.8-flash</code> المتقدم لفهم سياق الستريم الطويل واكتشاف اللحظات المشوقة.
                </p>
              </div>
            )}

            {activeTab === 'openai' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-200">
                    OpenAI API Key:
                  </label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    OpenAI API Dashboard
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="sk-proj-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stream-dark border border-stream-border text-white text-sm focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                />
                <p className="text-[11px] text-gray-400">
                  يستخدم موديل <code className="text-emerald-300">gpt-4o-mini</code> عالي السرعة والجودة.
                </p>
              </div>
            )}

            {activeTab === 'groq' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-200">
                    Groq Cloud API Key:
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    Groq Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stream-dark border border-stream-border text-white text-sm focus:outline-none focus:border-amber-500 font-mono transition-colors"
                />
                <p className="text-[11px] text-gray-400">
                  يوفر سرعة فائقة في تفريغ الصوت عبر Whisper-large-v3-turbo وتحليل المقاطع عبر LLaMA 3.3.
                </p>
              </div>
            )}
          </div>

          {/* Test Key Button & Result */}
          <div className="pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stream-border hover:bg-stream-border/80 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {testing ? 'جاري التحقق من المفتاح...' : 'اختبار صلاحية المفتاح الآن'}
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Speech-to-Text Whisper Setting */}
          <div className="p-4 rounded-xl bg-stream-dark/60 border border-stream-border space-y-3">
            <label className="text-xs font-bold text-gray-200 block">
              نظام تفريغ الصوت إلى نصوص متزامنة (Whisper Subtitles):
            </label>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-stream-border bg-stream-card cursor-pointer hover:border-gray-500">
                <input
                  type="radio"
                  name="whisper"
                  value="local"
                  checked={whisperProvider === 'local'}
                  onChange={() => setWhisperProvider('local')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-white">تفريغ محلي (Faster-Whisper)</div>
                  <div className="text-[10px] text-gray-400">يعمل بالكامل على جهازك مجاناً وبدون إنترنت</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-stream-border bg-stream-card cursor-pointer hover:border-gray-500">
                <input
                  type="radio"
                  name="whisper"
                  value="groq"
                  checked={whisperProvider === 'groq'}
                  onChange={() => setWhisperProvider('groq')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-white">سحابي فائق السرعة (Groq Whisper)</div>
                  <div className="text-[10px] text-gray-400">يفرغ ساعة كاملة في أقل من 10 ثوانٍ!</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stream-dark/70 border-t border-stream-border flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            مفاتيح الـ API يتم تخزينها واستخدامها محلياً بأمان.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-stream-border transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
