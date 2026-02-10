import { LayoutConfig, FrameSize } from './types';

// Helper to generate IDs
const generateId = (prefix: string, index: number) => `${prefix}-frame-${index}`;

// We calculate percentages based on a hypothetical canvas size to keep aspect ratios correct.
// The visual representation uses absolute positioning %.

export const LAYOUTS: LayoutConfig[] = [
  {
    id: 'lira',
    name: 'Lira',
    description: 'Three 20x20cm, Three 20x30cm (Total 65x55cm area)',
    totalWidthCm: 65,
    totalHeightCm: 55,
    frames: [
      // Top Row (roughly y=0 to y=45%)
      { id: 'lira-1', size: FrameSize.S20x20, x: 0, y: 0, width: 30.7, height: 36.3 },
      { id: 'lira-2', size: FrameSize.S20x30, x: 34.6, y: 0, width: 30.7, height: 54.5 },
      { id: 'lira-3', size: FrameSize.S20x20, x: 69.2, y: 0, width: 30.7, height: 36.3 },
      
      // Bottom Row
      { id: 'lira-4', size: FrameSize.S20x30, x: 0, y: 45.4, width: 30.7, height: 54.5 },
      { id: 'lira-5', size: FrameSize.S20x20, x: 34.6, y: 63.6, width: 30.7, height: 36.3 },
      { id: 'lira-6', size: FrameSize.S20x30, x: 69.2, y: 45.4, width: 30.7, height: 54.5 },
    ]
  },
  {
    id: 'noira',
    name: 'Noira',
    description: 'Two 20x20cm, Five 20x30cm (Total 75x85cm area)',
    totalWidthCm: 75,
    totalHeightCm: 85,
    frames: [
      // Central Cluster
      { id: 'noira-1', size: FrameSize.S20x30, x: 0, y: 30, width: 26.6, height: 35.2 }, // Left Mid
      { id: 'noira-2', size: FrameSize.S20x30, x: 29.3, y: 5, width: 26.6, height: 35.2 }, // Top Center Left
      { id: 'noira-3', size: FrameSize.S20x20, x: 58.6, y: 15, width: 26.6, height: 23.5 }, // Top Right Small
      
      { id: 'noira-4', size: FrameSize.S20x20, x: 14.6, y: 68, width: 26.6, height: 23.5 }, // Bottom Left Small
      { id: 'noira-5', size: FrameSize.S30x20, x: 29.3, y: 43, width: 40, height: 23.5 },  // Center Horizontal
      { id: 'noira-6', size: FrameSize.S20x30, x: 44, y: 69, width: 26.6, height: 35.2 }, // Bottom Center
      { id: 'noira-7', size: FrameSize.S20x30, x: 73.3, y: 43, width: 26.6, height: 35.2 }, // Right Mid
    ]
  },
  {
    id: 'zyra',
    name: 'Zyra',
    description: 'Four 20x20cm, Four 20x30cm (Total 100x65cm area)',
    totalWidthCm: 100,
    totalHeightCm: 65,
    frames: [
      // Top Row ZigZag
      { id: 'zyra-1', size: FrameSize.S20x20, x: 8, y: 15, width: 20, height: 30.7 },
      { id: 'zyra-2', size: FrameSize.S20x30, x: 30, y: 0, width: 20, height: 46 },
      { id: 'zyra-3', size: FrameSize.S30x20, x: 52, y: 15, width: 30, height: 30.7 },
      { id: 'zyra-4', size: FrameSize.S20x20, x: 84, y: 15, width: 20, height: 30.7 },

      // Bottom Row ZigZag
      { id: 'zyra-5', size: FrameSize.S20x20, x: 0, y: 49, width: 20, height: 30.7 },
      { id: 'zyra-6', size: FrameSize.S30x20, x: 22, y: 49, width: 30, height: 30.7 },
      { id: 'zyra-7', size: FrameSize.S20x30, x: 54, y: 49, width: 20, height: 46 },
      { id: 'zyra-8', size: FrameSize.S20x20, x: 76, y: 49, width: 20, height: 30.7 },
    ]
  },
  {
    id: 'elora',
    name: 'Elora',
    description: 'Seven 20x20cm, Three 20x30cm (Total 110x65cm area)',
    totalWidthCm: 110,
    totalHeightCm: 65,
    frames: [
      // Left Cluster
      { id: 'elora-1', size: FrameSize.S30x20, x: 15, y: 15, width: 27.2, height: 30.7 },
      { id: 'elora-2', size: FrameSize.S20x20, x: 0, y: 50, width: 18.1, height: 30.7 },
      { id: 'elora-3', size: FrameSize.S20x30, x: 20, y: 50, width: 18.1, height: 46 },
      
      // Center Column
      { id: 'elora-4', size: FrameSize.S20x20, x: 44, y: 5, width: 18.1, height: 30.7 },
      { id: 'elora-5', size: FrameSize.S20x20, x: 44, y: 38, width: 18.1, height: 30.7 },
      { id: 'elora-6', size: FrameSize.S20x20, x: 44, y: 71, width: 18.1, height: 30.7 },

      // Right Cluster
      { id: 'elora-7', size: FrameSize.S20x30, x: 64, y: 10, width: 18.1, height: 46 },
      { id: 'elora-8', size: FrameSize.S20x20, x: 64, y: 60, width: 18.1, height: 30.7 },
      { id: 'elora-9', size: FrameSize.S20x20, x: 84, y: 25, width: 18.1, height: 30.7 },
      { id: 'elora-10', size: FrameSize.S20x20, x: 84, y: 60, width: 18.1, height: 30.7 },
    ]
  }
];
