export enum FrameSize {
  S20x20 = '20x20cm',
  S20x30 = '20x30cm',
  S30x20 = '30x20cm',
}

export interface FrameData {
  id: string;
  size: FrameSize;
  // Position coordinates in percentages (0-100) relative to the layout container
  x: number; 
  y: number;
  width: number;
  height: number;
  
  // Visual Properties
  rotation?: number; // degrees
  fitMode?: 'cover' | 'contain' | 'custom';
  customRect?: { x: number; y: number; width: number; height: number };
  
  // Grouping
  groupId?: string;
}

export interface LayoutConfig {
  id: string;
  name: string;
  description: string;
  totalWidthCm: number;
  totalHeightCm: number;
  frames: FrameData[];
}

export interface UploadedImage {
  id: string;
  url: string;
  file: File;
}