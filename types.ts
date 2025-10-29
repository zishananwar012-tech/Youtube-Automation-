export enum Tab {
  CREATOR = 'Video Creator',
  CHAT = 'AI Chat',
  LIVE = 'Live Assistant',
  ANALYZE = 'Content Analyzer',
  GROUNDING = 'Explore Grounding',
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface Scene {
  description: string;
  imagePrompt: string;
}

export interface Script {
  title: string;
  scenes: Scene[];
}

export interface GeneratedImage {
  prompt: string;
  base64: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets: {
            uri: string;
            text: string;
        }[]
    }[]
  };
}