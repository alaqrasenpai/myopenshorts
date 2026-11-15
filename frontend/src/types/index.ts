export interface VideoMetadata {
  id?: string;
  title: string;
  uploader?: string;
  duration: number; // in seconds
  thumbnail?: string;
  platform: 'twitch' | 'kick' | 'youtube' | 'upload' | 'stream' | string;
  resolution?: string;
  fps?: number;
  description?: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface ClipItem {
  id: string;
  start_time: number;
  end_time: number;
  duration: number;
  formatted_start: string;
  formatted_end: string;
  timeline_range: string;
  hook_title: string;
  virality_score: number;
  category: string;
  reason: string;
  tags: string[];
  suggested_layout?: string;
  words?: WordTimestamp[];
  rendered_url?: string;
  rendered_file?: string;
  selected_layout?: string;
  selected_caption_style?: string;
  face_box?: FacecamInfo;
}

export interface FacecamInfo {
  quadrant: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export interface Project {
  id: string;
  title: string;
  source_type: 'url' | 'upload';
  source_url: string;
  status: 'created' | 'downloading' | 'downloaded' | 'processing' | 'ready' | 'error';
  progress: number;
  status_message: string;
  video_path?: string;
  audio_path?: string;
  metadata?: VideoMetadata;
  facecam_info?: FacecamInfo;
  clips?: ClipItem[];
  created_at: number;
  updated_at: number;
}

export interface AppSettings {
  gemini_api_key?: string;
  openai_api_key?: string;
  groq_api_key?: string;
  elevenlabs_api_key?: string;
  gemini_api_key_masked?: string;
  openai_api_key_masked?: string;
  groq_api_key_masked?: string;
  active_ai_provider: 'gemini' | 'openai' | 'groq';
  active_gemini_model: string;
  active_openai_model: string;
  active_groq_model: string;
  whisper_provider: 'local' | 'groq' | 'openai';
  whisper_model_size: string;
  default_layout: string;
  default_caption_style: string;
  auto_publish_webhook?: string;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  layout_type: 'split_screen' | 'blur_background' | 'face_track' | 'custom_sample';
  icon: string;
  sample_preview?: string;
  face_box?: { x: number; y: number; w: number; h: number };
  game_box?: { x: number; y: number; w: number; h: number };
  is_default?: boolean;
}
