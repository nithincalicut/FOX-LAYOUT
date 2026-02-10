import React, { useRef, useState, useEffect } from 'react';
import { Upload, ImageIcon, ArrowLeftRight, Trash2, Move } from 'lucide-react';
import { FrameData } from '../types';

interface PhotoFrameProps {
  frame: FrameData;
  imageUrl?: string;
  isCustom?: boolean;
  isSelected?: boolean;
  otherFrames?: FrameData[]; // Frames to snap against
  zIndex?: number; // Explicit z-index from parent
  
  // Visual Props Controlled by Parent
  rotation: number;
  
  isLayoutLocked: boolean;
  onPositionChange: (x: number, y: number) => void; // Deprecated for drag, kept for compat if needed
  
  // New Drag Handlers for Group Movement
  onFrameDragStart?: () => void;
  onFrameDragMove?: (deltaX: number, deltaY: number) => void;
  onFrameDragEnd?: (finalX: number, finalY: number) => void;
  onRef?: (el: HTMLDivElement | null) => void;

  onUpload: (file: File) => void;
  onRemove: () => void;
  onRotateFrame: () => void;
  onSwap: (sourceId: string) => void;
  onDragStart?: () => void; // Native drag start
  onDragEnd?: () => void;   // Native drag end
  onSelect?: (multi: boolean) => void;
}

type DragState = 
  | { type: 'frame-move'; startX: number; startY: number; startFramePos: { x: number; y: number }; parentSize: { width: number; height: number } };

// Simple Tooltip Helper
const Tooltip = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <div className="group/tooltip relative flex items-center">
    {children}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900/90 text-white text-[10px] font-medium rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-sm z-[100]">
      {label}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900/90" />
    </div>
  </div>
);

export const PhotoFrame: React.FC<PhotoFrameProps> = ({ 
  frame, 
  imageUrl, 
  isCustom, 
  isSelected, 
  otherFrames,
  zIndex,
  rotation,
  isLayoutLocked,
  onPositionChange,
  onFrameDragStart,
  onFrameDragMove,
  onFrameDragEnd,
  onRef,
  onUpload, 
  onRemove, 
  onRotateFrame, 
  onSwap, 
  onDragStart, 
  onDragEnd, 
  onSelect
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const currentDragPosRef = useRef<{ x: number; y: number } | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Global mouse event listeners for dragging (Frame Moving)
  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState]);

  const handleClick = (e: React.MouseEvent) => {
    // If we were just dragging a frame, don't trigger click
    if (currentDragPosRef.current) return;
    
    e.stopPropagation();
    
    // Select logic
    if (onSelect) {
        onSelect(e.shiftKey || e.ctrlKey || e.metaKey);
    }

    if (!imageUrl) {
       if (isSelected) {
         fileInputRef.current?.click();
       }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  const handleRotateFrameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRotateFrame();
  };

  // --- Drag & Drop (Native HTML5 for Swap / Upload) ---
  
  const handleNativeDragStart = (e: React.DragEvent) => {
      if (imageUrl) {
          e.dataTransfer.setData('application/wallart-frame-id', frame.id);
          e.dataTransfer.effectAllowed = 'move';
          if (onDragStart) onDragStart();
      } else {
          e.preventDefault();
      }
  };

  const handleNativeDragEnd = (e: React.DragEvent) => {
      if (onDragEnd) onDragEnd();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/wallart-frame-id')) {
        setIsDraggingFile(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/wallart-frame-id'))) {
        setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    // 1. Handle File Upload
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onUpload(file);
      }
      return;
    }

    // 2. Handle Frame Swap
    const sourceId = e.dataTransfer.getData('application/wallart-frame-id');
    if (sourceId && sourceId !== frame.id) {
        onSwap(sourceId);
    }
  };

  // --- Frame Moving Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    
     const parent = frameRef.current?.offsetParent as HTMLElement;
     if (!parent) return;
     
     // Notify parent drag is starting
     if (onFrameDragStart) onFrameDragStart();

     // Immediately disable transition for instant response
     if (frameRef.current) {
        frameRef.current.style.transition = 'none';
     }

     setDragState({
         type: 'frame-move',
         startX: e.clientX,
         startY: e.clientY,
         startFramePos: { x: frame.x, y: frame.y },
         parentSize: { width: parent.offsetWidth, height: parent.offsetHeight }
     });
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    // Handle Frame Moving (Direct DOM manipulation for smoothness)
    if (dragState.type === 'frame-move') {
        const { startFramePos, parentSize } = dragState;
        if (!startFramePos || !parentSize) return;
        
        const deltaPercentX = (deltaX / parentSize.width) * 100;
        const deltaPercentY = (deltaY / parentSize.height) * 100;
        
        let newX = startFramePos.x + deltaPercentX;
        let newY = startFramePos.y + deltaPercentY;

        // --- Snapping Logic ---
        // Snap to grid/other frames if they exist
        if (otherFrames) {
            const SNAP_PX = 12; // Snap sensitivity
            const GAP_PX = 16;  // Standard gap for maintained spacing

            const snapThreshX = (SNAP_PX / parentSize.width) * 100;
            const snapThreshY = (SNAP_PX / parentSize.height) * 100;
            
            const gapX = (GAP_PX / parentSize.width) * 100;
            const gapY = (GAP_PX / parentSize.height) * 100;

            const myW = frame.width;
            const myH = frame.height;

            // X Targets: Canvas Edges (0, 100), Center (50), Other Frames (Left, Right, Center)
            // We prioritize gaps over edge alignment slightly
            let bestDx = Infinity;
            let gapSnapFound = false;

            // 1. Check Spacing (Gaps) - Priority
            otherFrames.forEach(f => {
                // Snap My Left to (Neighbor Right + Gap)
                const targetL = f.x + f.width + gapX;
                const diffL = targetL - newX;
                if (Math.abs(diffL) < snapThreshX && Math.abs(diffL) < Math.abs(bestDx)) {
                    bestDx = diffL;
                    gapSnapFound = true;
                }

                // Snap My Right to (Neighbor Left - Gap)
                const targetR = f.x - gapX;
                const diffR = targetR - (newX + myW);
                if (Math.abs(diffR) < snapThreshX && Math.abs(diffR) < Math.abs(bestDx)) {
                    bestDx = diffR;
                    gapSnapFound = true;
                }
            });

            // 2. Check Alignment (Edges) - Only if no gap snap found or if edge snap is significantly tighter
            if (!gapSnapFound) {
                 const xTargets = [0, 50, 100]; 
                 otherFrames.forEach(f => {
                    xTargets.push(f.x);
                    xTargets.push(f.x + f.width);
                    xTargets.push(f.x + f.width/2);
                 });
                 const myEdgesX = [newX, newX + myW, newX + myW/2];
                 myEdgesX.forEach(edge => {
                    xTargets.forEach(target => {
                        const diff = target - edge;
                        if (Math.abs(diff) < snapThreshX && Math.abs(diff) < Math.abs(bestDx)) {
                            bestDx = diff;
                        }
                    });
                 });
            }

            if (bestDx !== Infinity) {
                newX += bestDx;
            }

            // Y Targets
            let bestDy = Infinity;
            let gapSnapFoundY = false;

            // 1. Check Spacing (Gaps) - Priority
            otherFrames.forEach(f => {
                 // Snap My Top to (Neighbor Bottom + Gap)
                 const targetTop = f.y + f.height + gapY;
                 const diffTop = targetTop - newY;
                 if (Math.abs(diffTop) < snapThreshY && Math.abs(diffTop) < Math.abs(bestDy)) {
                     bestDy = diffTop;
                     gapSnapFoundY = true;
                 }

                 // Snap My Bottom to (Neighbor Top - Gap)
                 const targetBottom = f.y - gapY;
                 const diffBottom = targetBottom - (newY + myH);
                 if (Math.abs(diffBottom) < snapThreshY && Math.abs(diffBottom) < Math.abs(bestDy)) {
                     bestDy = diffBottom;
                     gapSnapFoundY = true;
                 }
            });

            // 2. Check Alignment
            if (!gapSnapFoundY) {
                 const yTargets = [0, 50, 100];
                 otherFrames.forEach(f => {
                    yTargets.push(f.y);
                    yTargets.push(f.y + f.height);
                    yTargets.push(f.y + f.height/2);
                 });
                 const myEdgesY = [newY, newY + myH, newY + myH/2];
                 myEdgesY.forEach(edge => {
                    yTargets.forEach(target => {
                        const diff = target - edge;
                        if (Math.abs(diff) < snapThreshY && Math.abs(diff) < Math.abs(bestDy)) {
                            bestDy = diff;
                        }
                    });
                 });
            }

            if (bestDy !== Infinity) {
                newY += bestDy;
            }
        }
        
        // Track the position for commit on mouseup
        currentDragPosRef.current = { x: newX, y: newY };

        // Apply directly to DOM to avoid React re-render cycle during drag
        if (frameRef.current) {
            frameRef.current.style.left = `${newX}%`;
            frameRef.current.style.top = `${newY}%`;
        }

        // Notify parent of the effective delta (including snap)
        // Parent uses this to update OTHER selected frames
        if (onFrameDragMove) {
            const effectiveDeltaX = newX - startFramePos.x;
            const effectiveDeltaY = newY - startFramePos.y;
            onFrameDragMove(effectiveDeltaX, effectiveDeltaY);
        }

        return;
    }
  };

  const handleGlobalMouseUp = (e: MouseEvent) => {
    if (dragState?.type === 'frame-move') {
        // Commit the final position to React state
        if (currentDragPosRef.current) {
            if (onFrameDragEnd) {
                onFrameDragEnd(currentDragPosRef.current.x, currentDragPosRef.current.y);
            } else {
                onPositionChange(currentDragPosRef.current.x, currentDragPosRef.current.y);
            }
            
            // Note: We leave the styles as is, React will reconcile them on next render when props update
            // Re-enable transitions after a brief timeout so the snap-to-prop doesn't animate if there's a slight diff
            setTimeout(() => {
                if (frameRef.current) frameRef.current.style.transition = '';
                currentDragPosRef.current = null;
            }, 0);
        } else {
             if (frameRef.current) frameRef.current.style.transition = '';
        }
    }
    setDragState(null);
  };

  const isMovingFrame = dragState?.type === 'frame-move';

  // Determine effective Z-Index
  // If dragging a file over this frame, make it pop to top
  const effectiveZIndex = isDraggingFile ? 2000 : (zIndex ?? 0);

  return (
    <div
      ref={(el) => {
        frameRef.current = el;
        if (onRef) onRef(el);
      }}
      onMouseDown={(e) => {
        if (!isLayoutLocked) handleMouseDown(e);
      }}
      draggable={isLayoutLocked && !!imageUrl} // Enable native drag only if image exists and LOCKED
      onDragStart={handleNativeDragStart}
      onDragEnd={handleNativeDragEnd}
      className={`absolute bg-white shadow-gallery group 
      ${isSelected ? 'ring-2 ring-indigo-600 z-10' : ''}
      ${isDraggingFile ? 'ring-4 ring-indigo-400 ring-offset-2 scale-[1.02]' : ''}
      ${isMovingFrame ? 'cursor-grabbing' : 'hover:scale-[1.01] transition-[top,left,width,height,transform,box-shadow] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]'}
      `}
      style={{
        left: `${frame.x}%`,
        top: `${frame.y}%`,
        width: `${frame.width}%`,
        height: `${frame.height}%`,
        zIndex: effectiveZIndex, // Use computed z-index
        cursor: !isLayoutLocked ? (isMovingFrame ? 'grabbing' : 'grab') : 'pointer',
        transition: isMovingFrame ? 'none' : undefined
      }}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {/* Visual Indicator for Move Mode */}
      {!isLayoutLocked && (
         <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-1 rounded-full shadow-md z-30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Move size={12} />
         </div>
      )}

      <div className={`absolute inset-0 w-full h-full overflow-hidden`}>
        {imageUrl ? (
            <div className="relative w-full h-full bg-gray-50">
            <img
                ref={imgRef}
                src={imageUrl}
                alt="Uploaded frame content"
                draggable={false}
                style={{ 
                   transform: `rotate(${rotation}deg)` 
                }}
                className={`w-full h-full select-none object-cover transition-all duration-300 ease-out`}
            />
            </div>
        ) : (
            <div 
                className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors relative"
            >
                <div className="bg-white p-3 rounded-full mb-2 shadow-sm">
                    <ImageIcon size={24} className="text-gray-300" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {frame.size}
                </span>
                <span className="text-[10px] text-gray-400 mt-1">
                    {isSelected ? 'Click again to upload' : 'Click to select'}
                </span>

                {frame.size !== '20x20cm' && (
                     <div onClick={(e) => e.stopPropagation()}>
                        <Tooltip label="Rotate Frame Orientation">
                            <button 
                                onMouseDown={(e) => e.stopPropagation()} 
                                onClick={handleRotateFrameClick} 
                                className="mt-4 p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
                            >
                                <ArrowLeftRight size={16} />
                            </button>
                        </Tooltip>
                    </div>
                )}
                 {isCustom && (
                    <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="absolute top-2 right-2">
                        <Tooltip label="Delete Frame">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove();
                                }}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </Tooltip>
                    </div>
                )}
            </div>
        )}

        {/* Drag Overlay */}
        {isDraggingFile && (
             <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
                <div className="bg-white/90 p-4 rounded-full shadow-xl mb-3 transform scale-110">
                    <Upload size={32} className="text-indigo-600" />
                </div>
                <span className="text-sm font-bold text-indigo-700 bg-white/90 px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                    {imageUrl ? 'Drop to Swap' : 'Drop to Upload'}
                </span>
            </div>
        )}
      </div>
    </div>
  );
};