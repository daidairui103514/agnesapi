export interface ApiSettings {
  apiKey: string;
}

export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface VideoTaskResponse {
  request: {
    method: string;
    url: string;
    path_params: {
      task_id: string;
    };
  };
  task_id: string;
}

export interface VideoTaskStatus {
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  video_url?: string;
  error?: string;
}

export interface ImageHistoryItem {
  id: string;
  prompt: string;
  url: string;
  timestamp: number;
}

export interface VideoHistoryItem {
  id: string;
  prompt: string;
  url: string;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: any; // Allow string or array of parts
}

export interface ChatHistoryItem {
  id: string;
  messages: ChatMessage[];
  timestamp: number;
}
