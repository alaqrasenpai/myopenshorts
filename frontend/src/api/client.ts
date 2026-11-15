import { Project, AppSettings, LayoutTemplate, VideoMetadata } from '../types';

const API_BASE = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:8000';

export interface OpenCutSegment {
  start: number;
  end: number;
  speed?: number;
}

export interface SocialPackage {
  hook_title: string;
  category: string;
  duration: number;
  tiktok: {
    title: string;
    caption: string;
    recommended_sound: string;
  };
  youtube_shorts: {
    title: string;
    description: string;
    tags: string[];
    visibility: string;
  };
  instagram_reels: {
    caption: string;
    share_to_feed: boolean;
  };
}

export const api = {
  // Streams
  async inspectStream(url: string): Promise<{ status: string; info: VideoMetadata }> {
    const res = await fetch(`${API_BASE}/api/streams/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to inspect stream' }));
      throw new Error(err.detail || 'Failed to inspect stream');
    }
    return res.json();
  },

  async ingestStream(url: string, maxDurationMinutes: number = 60): Promise<{ status: string; project: Project }> {
    const res = await fetch(`${API_BASE}/api/streams/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, max_duration_minutes: maxDurationMinutes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to ingest stream' }));
      throw new Error(err.detail || 'Failed to ingest stream');
    }
    return res.json();
  },

  async uploadVideo(file: File, title?: string): Promise<{ status: string; project: Project }> {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    const res = await fetch(`${API_BASE}/api/streams/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload video' }));
      throw new Error(err.detail || 'Failed to upload video');
    }
    return res.json();
  },

  // Clips & Processing
  async processProject(projectId: string, aiProvider?: string, apiKey?: string, targetCount: number = 5): Promise<any> {
    const res = await fetch(`${API_BASE}/api/clips/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        ai_provider: aiProvider,
        api_key: apiKey,
        target_clips_count: targetCount,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to process project' }));
      throw new Error(err.detail || 'Failed to process project');
    }
    return res.json();
  },

  async getProject(projectId: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/api/clips/project/${projectId}`);
    if (!res.ok) {
      throw new Error('Project not found');
    }
    return res.json();
  },

  async listProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/api/projects`);
    if (!res.ok) {
      throw new Error('Failed to list projects');
    }
    return res.json();
  },

  async renderClip(payload: {
    project_id: string;
    clip_id: string;
    start_time: number;
    end_time: number;
    layout?: string;
    caption_style?: string;
    face_box?: { x: number; y: number; w: number; h: number };
    game_box?: { x: number; y: number; w: number; h: number };
  }): Promise<{ status: string; download_url: string; filename: string }> {
    const res = await fetch(`${API_BASE}/api/clips/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Rendering failed' }));
      throw new Error(err.detail || 'Rendering failed');
    }
    return res.json();
  },

  async detectFacecam(payload: {
    project_id: string;
    clip_id?: string;
    start_time?: number;
    end_time?: number;
  }): Promise<{ status: string; facecam_info: { quadrant: string; x: number; y: number; w: number; h: number; confidence: number } }> {
    const res = await fetch(`${API_BASE}/api/clips/detect-facecam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to detect facecam' }));
      throw new Error(err.detail || 'Failed to detect facecam');
    }
    return res.json();
  },

  // OpenCut Manual Multi-track Timeline Editor
  async detectSilences(projectId: string, start: number, end: number): Promise<{ silences: Array<{ start: number; end: number; duration: number }> }> {
    const res = await fetch(`${API_BASE}/api/opencut/silences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, start_time: start, end_time: end }),
    });
    if (!res.ok) throw new Error('Failed to detect silences');
    return res.json();
  },

  async renderOpenCutManual(payload: {
    project_id: string;
    clip_id: string;
    segments: OpenCutSegment[];
    text_overlays?: any[];
    target_aspect_ratio?: string;
    color_grade?: string;
    enable_audio_microfades?: boolean;
  }): Promise<{ status: string; download_url: string; filename: string }> {
    const res = await fetch(`${API_BASE}/api/opencut/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'OpenCut render failed' }));
      throw new Error(err.detail || 'OpenCut render failed');
    }
    return res.json();
  },

  // Video-Use Natural Language Agent Editing
  async executeAgentEdit(payload: {
    project_id: string;
    clip_id: string;
    instruction: string;
    ai_provider?: string;
    api_key?: string;
  }): Promise<{ status: string; explanation: string; download_url: string; filename: string; operations: any }> {
    const res = await fetch(`${API_BASE}/api/opencut/agent-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Agent edit failed' }));
      throw new Error(err.detail || 'Agent edit failed');
    }
    return res.json();
  },

  // AutoClip Multi-Platform Packaging & Cover
  async getAutoClipPackage(projectId: string, clipId: string): Promise<{ status: string; package: SocialPackage }> {
    const res = await fetch(`${API_BASE}/api/autoclip/package/${projectId}/${clipId}`);
    if (!res.ok) throw new Error('Failed to get AutoClip package');
    return res.json();
  },

  async generateCoverThumbnail(projectId: string, clipId: string, timestamp?: number, headline?: string): Promise<{ status: string; cover_url: string; filename: string }> {
    const res = await fetch(`${API_BASE}/api/autoclip/generate-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        clip_id: clipId,
        timestamp_sec: timestamp,
        headline_text: headline,
      }),
    });
    if (!res.ok) throw new Error('Failed to generate cover');
    return res.json();
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/api/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<any> {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async testApiKey(provider: string, apiKey: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/settings/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'API Key validation failed' }));
      throw new Error(err.detail || 'API Key validation failed');
    }
    return res.json();
  },

  // Templates
  async listTemplates(): Promise<LayoutTemplate[]> {
    const res = await fetch(`${API_BASE}/api/templates`);
    if (!res.ok) throw new Error('Failed to list templates');
    return res.json();
  },

  async uploadSampleTemplate(file: File, name: string): Promise<any> {
    const formData = new FormData();
    formData.append('sample_image', file);
    formData.append('name', name);
    const res = await fetch(`${API_BASE}/api/templates/upload-sample`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload sample template');
    return res.json();
  },

  getDownloadUrl(filename: string): string {
    return `${API_BASE}/api/clips/download/${filename}`;
  }
};
