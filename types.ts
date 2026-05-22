
export interface GeneratedProject {
  id: string;
  name: string;
  prompt: string;
  code: string;
  timestamp: number;
  parentId?: string; // Menyimpan ID projek asal jika ini adalah refinement
}

export enum PreviewDevice {
  DESKTOP = 'desktop',
  MOBILE = 'mobile'
}

export type Orientation = 'portrait' | 'landscape';

export type ViewMode = 'build' | 'preview' | 'code';