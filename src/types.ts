export interface ApiSettings {
  apiKey: string;
  baseUrl?: string;
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
  taskId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: any; // Allow string or array of parts
  model?: string; // model name used for assistant replies
}

export interface ChatHistoryItem {
  id: string;
  messages: ChatMessage[];
  timestamp: number;
  model?: string; // what model was mainly used in this chat
}
