import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, Scissors, RotateCcw, Move, AlertTriangle } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  aspectRatio: number; // width / height
  onCrop: (croppedUrl: string) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageUrl, aspectRatio, onCrop, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interactionType, setInteractionType] = useState<'none' | 'pan' | 'zoom'>('none');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isConfirming, setIsConfirming] = useState(false);
  const [containerDims, setContainerDims] = useState({ width: 0, height: 0 });
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const startZoomRef = useRef(1);
  const startDistRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  
  const MAX_ZOOM = 3;
  const MIN_ZOOM = 0.5;

  // Initialize container size based on viewport
  useEffect(() => {
    const updateSize = () => {
      const w = Math.min(window.innerWidth * 0.9, 600);
      const h = Math.min(window.innerHeight * 0.5, 400);
      setContainerDims({ width: w, height: h });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate crop window size based on container
  const MAX_CROP_W = containerDims.width * 0.85;
  const MAX_CROP_H = containerDims.height * 0.85;

  let cropWidth = 0, cropHeight = 0;
  if (containerDims.width > 0) {
    if (aspectRatio > 1) {
        cropWidth = Math.min(MAX_CROP_W, MAX_CROP_H * aspectRatio);
        cropHeight = cropWidth / aspectRatio;
    } else {
        cropHeight = Math.min(MAX_CROP_H, MAX_CROP_W / aspectRatio);
        cropWidth = cropHeight * aspectRatio;
    }
  }
  
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setInteractionType('pan');
      lastMousePos.current = { x: clientX, y: clientY };
  };

  const handleCornerMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setInteractionType('zoom');
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dist = Math.hypot(clientX - cx, clientY - cy);
          startDistRef.current = dist;
          startZoomRef.current = zoom;
      }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (interactionType === 'none') return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      if (interactionType === 'pan') {
          const deltaX = clientX - lastMousePos.current.x;
          const deltaY = clientY - lastMousePos.current.y;
          lastMousePos.current = { x: clientX, y: clientY };
          
          setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      } else if (interactionType === 'zoom') {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const currentDist = Math.hypot(clientX - cx, clientY - cy);
              const ratio = startDistRef.current / (currentDist || 0.1); 
              const newZoom = startZoomRef.current * ratio;
              setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)));
          }
      }
  };

  const handleMouseUp = () => setInteractionType('none');

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleReset = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsConfirming(false);
  };

  const performCrop = () => {
      const img = imageRef.current;
      if (!img || !imageSize.width) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const baseScale = Math.min(containerDims.width / imageSize.width, containerDims.height / imageSize.height);
      const factor = 1 / (baseScale * zoom);
      
      const centerOffsetX = (imageSize.width * baseScale * zoom) / 2 - pan.x;
      const centerOffsetY = (imageSize.height * baseScale * zoom) / 2 - pan.y;
      
      const cropX_Vis = centerOffsetX - cropWidth / 2;
      const cropY_Vis = centerOffsetY - cropHeight / 2;
      
      const sourceX = cropX_Vis * factor;
      const sourceY = cropY_Vis * factor;
      const sourceW = cropWidth * factor;
      const sourceH = cropHeight * factor;
      
      canvas.width = sourceW;
      canvas.height = sourceH;
      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
      
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
      onCrop(croppedUrl);
  };
  
  const handleApplyClick = () => {
    if (isConfirming) performCrop();
    else {
        setIsConfirming(true);
        setTimeout(() => setIsConfirming(false), 3000);
    }
  };
  
  const baseScale = imageSize.width ? Math.min(containerDims.width / imageSize.width, containerDims.height / imageSize.height) : 1;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl flex flex-col max-h-full">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Scissors size={20} className="text-indigo-600"/>
                    Crop Image
                </h3>
                <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={24} className="text-gray-500" />
                </button>
            </div>

            <div 
                 className="relative bg-gray-950 overflow-hidden flex items-center justify-center select-none cursor-move min-h-[300px] flex-1"
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
                 onTouchStart={handleMouseDown}
                 onTouchMove={handleMouseMove}
                 onTouchEnd={handleMouseUp}
                 onWheel={handleWheel}
            >
                <div 
                    ref={containerRef}
                    className="relative flex items-center justify-center" 
                    style={{ width: containerDims.width, height: containerDims.height }}
                >
                    <img 
                        ref={imageRef}
                        src={imageUrl}
                        onLoad={handleImageLoad}
                        alt="Crop target"
                        draggable={false}
                        style={{
                            width: imageSize.width * baseScale,
                            height: imageSize.height * baseScale,
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: 'center',
                            transition: interactionType !== 'none' ? 'none' : 'transform 0.1s ease-out',
                            maxWidth: 'none', 
                            maxHeight: 'none'
                        }}
                    />

                    <div 
                        className="absolute pointer-events-none"
                        style={{
                            width: cropWidth,
                            height: cropHeight,
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
                            border: '2px solid rgba(255, 255, 255, 0.5)'
                        }}
                    >
                        {/* Interactive Corner Handles */}
                        <div className="absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-white shadow-lg cursor-nw-resize pointer-events-auto" onMouseDown={handleCornerMouseDown} onTouchStart={handleCornerMouseDown}></div>
                        <div className="absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-white shadow-lg cursor-ne-resize pointer-events-auto" onMouseDown={handleCornerMouseDown} onTouchStart={handleCornerMouseDown}></div>
                        <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-white shadow-lg cursor-sw-resize pointer-events-auto" onMouseDown={handleCornerMouseDown} onTouchStart={handleCornerMouseDown}></div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-white shadow-lg cursor-se-resize pointer-events-auto" onMouseDown={handleCornerMouseDown} onTouchStart={handleCornerMouseDown}></div>
                    </div>
                </div>
                
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none px-4">
                   <span className="bg-black/60 text-white px-4 py-2 rounded-full text-[10px] md:text-xs backdrop-blur-md shadow-lg flex items-center gap-2 inline-flex border border-white/10">
                       <Move size={12} /> Drag to pan • Drag corners to zoom
                   </span>
                </div>
            </div>

            <div className="p-4 bg-white border-t flex flex-col gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.1))} 
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <ZoomOut size={20} />
                    </button>
                    
                    <input 
                        type="range" 
                        min={MIN_ZOOM} 
                        max={MAX_ZOOM} 
                        step={0.01} 
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                    />

                    <button 
                        onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.1))} 
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <ZoomIn size={20} />
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    <button 
                        onClick={handleReset} 
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                        <RotateCcw size={14} />
                        <span className="hidden sm:inline">Reset</span>
                    </button>
                </div>
                
                <div className="flex gap-2 justify-end">
                    <button 
                        onClick={onCancel}
                        className="flex-1 sm:flex-none px-6 py-2.5 text-gray-700 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleApplyClick}
                        className={`flex-1 sm:flex-none px-8 py-2.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg text-sm ${
                            isConfirming 
                            ? 'bg-orange-500 hover:bg-orange-600 text-white ring-4 ring-orange-100' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                        }`}
                    >
                        {isConfirming ? (
                            <>
                              <AlertTriangle size={18} />
                              <span>Confirm?</span>
                            </>
                        ) : (
                            <>
                              <Check size={18} />
                              <span>Apply Crop</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};