export type ProductType = 'Fashion' | 'Food' | 'Tech' | 'Beauty' | 'Other';
export type Style = 'Luxury' | 'Minimal' | 'Instagram' | 'E-commerce' | 'Cinematic';
export type TargetPlatform = 'Instagram' | 'Amazon' | 'Website Ads';
export type LightingMood = 'Golden Hour' | 'Cyberpunk' | 'Studio Soft' | 'Natural Window' | 'Moody Dark';
export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5';
export type CampaignChapter = 'Teaser' | 'Hero' | 'Lifestyle' | 'Sale';
export type MockupMode = 'none' | 'instagram' | 'facebook' | 'amazon';
export type LightingAccent = 'none' | 'rim-light' | 'spotlight' | 'neon-glow' | 'caustics';

export interface FocusGroupPersona {
  name: string;
  avatar: string;
  feedback: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
}

export interface ResultItem {
  id: string;
  image: string;
  caption: {
    instagram: string;
    adCopy: string;
  };
  style: string;
  lighting: string;
  aspectRatio: string;
  timestamp: number;
  chapter?: CampaignChapter;
  score?: number;
  analysis?: string;
  accent?: LightingAccent;
  focusGroup?: FocusGroupPersona[];
  heatmapData?: HeatmapPoint[];
}

export interface AppState {
  step: 'home' | 'input' | 'processing' | 'result';
  productImage: string | null;
  userImage: string | null;
  productType?: ProductType;
  style?: Style;
  lighting?: LightingMood;
  aspectRatio?: AspectRatio;
  backgroundPreference?: string;
  targetPlatform?: TargetPlatform;
  results: ResultItem[];
  currentResultIndex: number;
  history: ResultItem[];
  showGrid: boolean;
  showHeatmap: boolean;
  error: string | null;
  lightPosition: { x: number; y: number };
  refinePrompt?: string;
  isCampaignMode: boolean;
  mockupMode: MockupMode;
  addHumanTouch: boolean;
  activeAccent: LightingAccent;
  isTryOnMode: boolean;
}
