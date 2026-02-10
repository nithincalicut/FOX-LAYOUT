import React from 'react';
import { LAYOUTS } from '../constants';
import { LayoutGrid } from 'lucide-react';

interface LayoutSelectorProps {
  currentLayoutId: string;
  onSelect: (id: string) => void;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({ currentLayoutId, onSelect }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      {LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          onClick={() => onSelect(layout.id)}
          className={`
            relative p-4 rounded-xl border-2 text-left transition-all duration-200 flex flex-col items-start
            ${
              currentLayoutId === layout.id
                ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200 ring-offset-1'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
            }
          `}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className={`font-bold text-lg ${currentLayoutId === layout.id ? 'text-indigo-700' : 'text-gray-700'}`}>
              {layout.name}
            </span>
            {currentLayoutId === layout.id && <LayoutGrid size={18} className="text-indigo-600" />}
          </div>
          <div className="text-xs text-gray-500 mb-3 line-clamp-2">
            {layout.description}
          </div>
          <div className="mt-auto pt-2 border-t border-gray-100 w-full flex justify-between items-center text-xs font-medium text-gray-400">
             <span>{layout.frames.length} Frames</span>
             <span>{layout.totalWidthCm}x{layout.totalHeightCm}cm</span>
          </div>
        </button>
      ))}
    </div>
  );
};
