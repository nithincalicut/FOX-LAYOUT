import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PhotoFrame } from './components/PhotoFrame';
import { ImageCropper } from './components/ImageCropper';
import { LAYOUTS } from './constants';
import { FrameData, FrameSize } from './types';
import { 
    Download, Trash2, Camera, ZoomIn, ZoomOut, RotateCcw, ImagePlus, Wallpaper, 
    AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, ArrowDownToLine, ScanLine, Loader2,
    Grid, X, Images, RotateCw, ArrowLeftRight, Upload, ChevronDown, Scissors,
    Lock, Unlock, LayoutDashboard, Group, Ungroup
} from 'lucide-react';
import { toPng } from 'html-to-image';

const App: React.FC = () => {
  const [activeLayoutId, setActiveLayoutId] = useState<string>(LAYOUTS[0].id);
  const [canvasSize, setCanvasSize] = useState({ width: 200, height: 150 });
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [imageLibrary, setImageLibrary] = useState<string[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [croppingSession, setCroppingSession] = useState<{ id: string; url: string; aspectRatio: number } | null>(null);
  const [wallImage, setWallImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());
  const [marqueeSelection, setMarqueeSelection] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const pendingAddSize = useRef<FrameSize | 'custom' | null>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const customFileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStartPositions = useRef<Record<string, {x: number, y: number}>>({});
  const [containerDims, setContainerDims] = useState({ width: 0, height: 0 });

  const currentLayoutConfig = useMemo(
    () => LAYOUTS.find((l) => l.id === activeLayoutId) || LAYOUTS[0],
    [activeLayoutId]
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mainContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
         setContainerDims({
            width: entry.contentRect.width,
            height: entry.contentRect.height
         });
      }
    });
    observer.observe(mainContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scaleX = currentLayoutConfig.totalWidthCm / canvasSize.width;
    const scaleY = currentLayoutConfig.totalHeightCm / canvasSize.height;
    const offsetX = (100 - (100 * scaleX)) / 2;
    const offsetY = 5;
    const scaledFrames = currentLayoutConfig.frames.map(f => ({
        ...f,
        x: (f.x * scaleX) + offsetX,
        y: (f.y * scaleY) + offsetY,
        width: f.width * scaleX,
        height: f.height * scaleY,
        rotation: 0,
        fitMode: 'cover' as const,
        groupId: undefined
    }));
    setFrames(scaledFrames);
    setSelectedFrameIds(new Set()); 
  }, [currentLayoutConfig]);

  const handleDimensionsChange = (newWidth: number, newHeight: number) => {
    if (newWidth <= 0 || newHeight <= 0) return;
    const scaleX = canvasSize.width / newWidth;
    const scaleY = canvasSize.height / newHeight;
    setFrames(prev => prev.map(f => ({
        ...f,
        x: f.x * scaleX,
        y: f.y * scaleY,
        width: f.width * scaleX,
        height: f.height * scaleY,
    })));
    setCanvasSize({ width: newWidth, height: newHeight });
  };

  const toggleSelection = (id: string, multi: boolean) => {
      const targetFrame = frames.find(f => f.id === id);
      const groupIdsToToggle = new Set<string>();
      if (targetFrame && targetFrame.groupId) {
          frames.forEach(f => {
              if (f.groupId === targetFrame.groupId) groupIdsToToggle.add(f.id);
          });
      } else {
          groupIdsToToggle.add(id);
      }
      setSelectedFrameIds(prev => {
          const newSet = new Set(multi ? prev : []);
          const isPrimarySelected = prev.has(id);
          groupIdsToToggle.forEach(gId => {
              if (multi) {
                  if (isPrimarySelected) newSet.delete(gId);
                  else newSet.add(gId);
              } else {
                  newSet.add(gId);
              }
          });
          return newSet;
      });
  };

  const clearSelection = () => setSelectedFrameIds(new Set());

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (e.target !== containerRef.current && e.target !== e.currentTarget) return;
      if (e.button !== 0) return;
      clearSelection();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX;
      const startY = e.clientY;
      setMarqueeSelection({ startX, startY, currentX: startX, currentY: startY });
      const handleWindowMouseMove = (ev: MouseEvent) => {
          setMarqueeSelection(prev => prev ? { ...prev, currentX: ev.clientX, currentY: ev.clientY } : null);
      };
      const handleWindowMouseUp = (ev: MouseEvent) => {
          const endX = ev.clientX;
          const endY = ev.clientY;
          const contRect = containerRef.current?.getBoundingClientRect();
          if (contRect) {
              const boxLeft = Math.min(startX, endX) - contRect.left;
              const boxTop = Math.min(startY, endY) - contRect.top;
              const boxRight = Math.max(startX, endX) - contRect.left;
              const boxBottom = Math.max(startY, endY) - contRect.top;
              const newSelected = new Set<string>();
              frames.forEach(f => {
                  const fx = f.x * contRect.width / 100;
                  const fy = f.y * contRect.height / 100;
                  const fw = f.width * contRect.width / 100;
                  const fh = f.height * contRect.height / 100;
                  if (fx < boxRight && fx + fw > boxLeft && fy < boxBottom && fy + fh > boxTop) {
                      newSelected.add(f.id);
                  }
              });
              if (newSelected.size > 0) setSelectedFrameIds(newSelected);
          }
          setMarqueeSelection(null);
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
      };
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleGroupFrames = () => {
      if (selectedFrameIds.size < 2) return;
      const newGroupId = `group-${Date.now()}`;
      setFrames(prev => prev.map(f => selectedFrameIds.has(f.id) ? { ...f, groupId: newGroupId } : f));
  };

  const handleUngroupFrames = () => {
      if (selectedFrameIds.size === 0) return;
      setFrames(prev => prev.map(f => selectedFrameIds.has(f.id) ? { ...f, groupId: undefined } : f));
  };

  const updateFrame = (id: string, updates: Partial<FrameData>) => {
      setFrames(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleFrameDragStart = (activeFrameId: string) => {
      const activeFrame = frames.find(f => f.id === activeFrameId);
      const idsToDrag = new Set<string>();
      idsToDrag.add(activeFrameId);
      if (activeFrame?.groupId) {
          frames.forEach(f => {
              if (f.groupId === activeFrame.groupId) idsToDrag.add(f.id);
          });
      }
      if (selectedFrameIds.has(activeFrameId)) {
          selectedFrameIds.forEach(id => idsToDrag.add(id));
          const groupsInSelection = new Set<string>();
          frames.forEach(f => {
              if (selectedFrameIds.has(f.id) && f.groupId) groupsInSelection.add(f.groupId);
          });
          frames.forEach(f => {
              if (f.groupId && groupsInSelection.has(f.groupId)) idsToDrag.add(f.id);
          });
      }
      const movingIds = Array.from(idsToDrag);
      dragStartPositions.current = {};
      frames.forEach(f => {
          if (movingIds.includes(f.id)) {
              dragStartPositions.current[f.id] = { x: f.x, y: f.y };
          }
      });
  };

  const handleFrameDragMove = (activeFrameId: string, deltaX: number, deltaY: number) => {
      const movingIds = Object.keys(dragStartPositions.current);
      const movingFramesWithProjectedPos: { id: string, y: number, x: number }[] = [];
      movingIds.forEach(id => {
          const startPos = dragStartPositions.current[id];
          const newX = startPos.x + deltaX;
          const newY = startPos.y + deltaY;
          movingFramesWithProjectedPos.push({ id, x: newX, y: newY });
          if (id === activeFrameId) return;
          const el = frameRefs.current[id];
          if (el) {
              el.style.left = `${newX}%`;
              el.style.top = `${newY}%`;
              el.style.transition = 'none';
          }
      });
      movingFramesWithProjectedPos.sort((a, b) => {
          const diffY = a.y - b.y;
          if (Math.abs(diffY) > 0.1) return diffY;
          return a.x - b.x;
      });
      movingFramesWithProjectedPos.forEach((item, index) => {
          const el = frameRefs.current[item.id];
          if (el) el.style.zIndex = `${3000 + index}`;
      });
  };

  const handleFrameDragEnd = (activeFrameId: string, finalX: number, finalY: number) => {
      const startActive = dragStartPositions.current[activeFrameId];
      if (!startActive) {
          updateFrame(activeFrameId, { x: finalX, y: finalY });
          return;
      }
      const totalDeltaX = finalX - startActive.x;
      const totalDeltaY = finalY - startActive.y;
      setFrames(prev => prev.map(f => {
          if (dragStartPositions.current[f.id]) {
              const el = frameRefs.current[f.id];
              if (el) {
                  el.style.transition = '';
                  el.style.zIndex = '';
              }
              const start = dragStartPositions.current[f.id];
              return { ...f, x: start.x + totalDeltaX, y: start.y + totalDeltaY };
          }
          return f;
      }));
  };

  const zIndices = useMemo(() => {
    const sorted = [...frames].sort((a, b) => {
         const diffY = a.y - b.y;
         if (Math.abs(diffY) > 0.1) return diffY; 
         return a.x - b.x;
    });
    const map: Record<string, number> = {};
    sorted.forEach((frame, index) => {
         let z = index + 10;
         if (selectedFrameIds.has(frame.id)) z += 500;
         map[frame.id] = z;
    });
    return map;
  }, [frames, selectedFrameIds]);

  const addToLibrary = (url: string) => setImageLibrary(p => p.includes(url) ? p : [...p, url]);

  const handleAutoRotateFrame = (frameId: string, imgW: number, imgH: number) => {
    const frameIndex = frames.findIndex(f => (f.id.startsWith('custom') ? f.id : `${currentLayoutConfig.id}-${f.id}`) === frameId);
    if (frameIndex === -1) return;
    setFrames(prevFrames => {
        const frame = prevFrames[frameIndex];
        if (frame.size === FrameSize.S20x20) return prevFrames;
        const imgRatio = imgW / imgH;
        const frameRatio = (frame.width * canvasSize.width) / (frame.height * canvasSize.height);
        if ((imgRatio > 1.1 && frameRatio < 0.9) || (imgRatio < 0.9 && frameRatio > 1.1)) {
            const newFrames = [...prevFrames];
            const target = { ...newFrames[frameIndex] };
            const oldWidthCm = (target.width / 100) * canvasSize.width;
            const oldHeightCm = (target.height / 100) * canvasSize.height;
            target.width = (oldHeightCm / canvasSize.width) * 100;
            target.height = (oldWidthCm / canvasSize.height) * 100;
            if (target.size === FrameSize.S20x30) target.size = FrameSize.S30x20;
            else if (target.size === FrameSize.S30x20) target.size = FrameSize.S20x30;
            const cx = frame.x + frame.width / 2;
            const cy = frame.y + frame.height / 2;
            target.x = cx - target.width / 2;
            target.y = cy - target.height / 2;
            newFrames[frameIndex] = target;
            return newFrames;
        }
        return prevFrames;
    });
  };

  const handleImageUpload = (frameId: string, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    addToLibrary(objectUrl);
    setImages(prev => ({ ...prev, [frameId]: objectUrl }));
    const img = new Image();
    img.onload = () => handleAutoRotateFrame(frameId, img.naturalWidth, img.naturalHeight);
    img.src = objectUrl;
    const frameDataId = frames.find(f => (f.id.startsWith('custom') ? f.id : `${currentLayoutConfig.id}-${f.id}`) === frameId)?.id;
    if (frameDataId) updateFrame(frameDataId, { rotation: 0, fitMode: 'cover' });
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) setWallImage(URL.createObjectURL(e.target.files[0]));
      if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const handleRemoveBg = () => {
      setWallImage(null);
      if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const handleAddCustomPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const url = URL.createObjectURL(e.target.files[0]);
          addToLibrary(url);
          createCustomFrame(url, pendingAddSize.current);
      }
      if (customFileRef.current) customFileRef.current.value = '';
      pendingAddSize.current = null;
      setIsAddMenuOpen(false);
  };

  const handleAddOptionClick = (size: FrameSize | 'custom') => {
      pendingAddSize.current = size;
      customFileRef.current?.click();
      setIsAddMenuOpen(false);
  };

  const createCustomFrame = (imageUrl: string, targetSize?: FrameSize | 'custom' | null) => {
      const img = new Image();
      img.onload = () => {
          let wCm = 20, hCm = 20, size = FrameSize.S20x20;
          
          if (targetSize === FrameSize.S20x20) { 
              wCm = 20; hCm = 20; size = FrameSize.S20x20; 
          } else if (targetSize === FrameSize.S20x30) { 
              wCm = 20; hCm = 30; size = FrameSize.S20x30; 
          } else {
              // Auto-detect standard size based on image aspect ratio
              const ratio = img.naturalWidth / img.naturalHeight;
              if (ratio > 1.2) {
                  // Landscape -> 30x20
                  wCm = 30; hCm = 20; size = FrameSize.S30x20;
              } else if (ratio < 0.8) {
                  // Portrait -> 20x30
                  wCm = 20; hCm = 30; size = FrameSize.S20x30;
              } else {
                  // Square-ish -> 20x20
                  wCm = 20; hCm = 20; size = FrameSize.S20x20;
              }
          }

          const count = frames.length;
          const newFrame: FrameData = {
              id: `custom-frame-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              size,
              x: (count * 2) % 60 + 5,
              y: (count * 2) % 60 + 5,
              width: (wCm / canvasSize.width) * 100,
              height: (hCm / canvasSize.height) * 100,
              rotation: 0,
              fitMode: 'cover'
          };
          setFrames(p => [...p, newFrame]);
          setImages(p => ({ ...p, [`${currentLayoutConfig.id}-${newFrame.id}`]: imageUrl }));
      };
      img.src = imageUrl;
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles: File[] = Array.from(e.target.files);
          const newImages: Record<string, string> = {};
          const emptyFrames = frames.filter(f => {
              const uid = f.id.startsWith('custom') ? f.id : `${currentLayoutConfig.id}-${f.id}`;
              return !images[uid] && !newImages[uid];
          });
          newFiles.forEach((file, index) => {
              const url = URL.createObjectURL(file);
              addToLibrary(url);
              if (index < emptyFrames.length) {
                  const frame = emptyFrames[index];
                  const uid = frame.id.startsWith('custom') ? frame.id : `${currentLayoutConfig.id}-${frame.id}`;
                  newImages[uid] = url;
                  const img = new Image();
                  img.onload = () => handleAutoRotateFrame(uid, img.naturalWidth, img.naturalHeight);
                  img.src = url;
              } else { createCustomFrame(url, 'custom'); }
          });
          setImages(p => ({ ...p, ...newImages }));
      }
      if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  const handleSelectFromGallery = (url: string) => {
      if (selectedFrameIds.size > 0) {
          const newAssigns: Record<string, string> = {};
          frames.forEach(f => {
              if (selectedFrameIds.has(f.id)) {
                  const uid = f.id.startsWith('custom') ? f.id : `${currentLayoutConfig.id}-${f.id}`;
                  newAssigns[uid] = url;
                  updateFrame(f.id, { rotation: 0, fitMode: 'cover' });
                  const img = new Image();
                  img.onload = () => handleAutoRotateFrame(uid, img.naturalWidth, img.naturalHeight);
                  img.src = url;
              }
          });
          setImages(p => ({ ...p, ...newAssigns }));
      } else { createCustomFrame(url, 'custom'); }
      setIsGalleryOpen(false);
  };
  
  const handleCropRequest = (frameId: string, uniqueId: string) => {
      const url = images[uniqueId];
      const frame = frames.find(f => f.id === frameId);
      if (url && frame) {
          setCroppingSession({ id: uniqueId, url, aspectRatio: (frame.width * canvasSize.width) / (frame.height * canvasSize.height) });
      }
  };

  const handleCropSave = (newUrl: string) => {
      if (croppingSession) {
          addToLibrary(newUrl);
          setImages(p => ({ ...p, [croppingSession.id]: newUrl }));
          const frameDataId = frames.find(f => (f.id.startsWith('custom') ? f.id : `${currentLayoutConfig.id}-${f.id}`) === croppingSession.id)?.id;
          if (frameDataId) updateFrame(frameDataId, { rotation: 0 });
          setCroppingSession(null);
      }
  };

  const handleRotateImageContent = async (uniqueId: string) => {
    const imgUrl = images[uniqueId];
    if (!imgUrl) return;
    const img = new Image();
    img.src = imgUrl;
    await new Promise((resolve) => { img.onload = resolve; });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const newUrl = canvas.toDataURL('image/jpeg', 0.95);
    addToLibrary(newUrl);
    setImages(p => ({ ...p, [uniqueId]: newUrl }));
    const frameId = frames.find(f => (f.id.startsWith('custom') ? f.id : `${currentLayoutConfig.id}-${f.id}`) === uniqueId)?.id;
    if (frameId) updateFrame(frameId, { rotation: 0 });
  };

  const handleRemoveFrame = (id: string, uid: string) => {
      if (id.startsWith('custom')) {
          setFrames(p => p.filter(f => f.id !== id));
          setSelectedFrameIds(p => { const n = new Set(p); n.delete(id); return n; });
      }
      setImages(p => { const n = { ...p }; delete n[uid]; return n; });
  };

  const handleClearAll = () => {
      if(window.confirm("Remove all?")) {
          setImages({});
          setFrames(p => p.filter(f => !f.id.startsWith('custom')));
          setSelectedFrameIds(new Set());
      }
  };

  const handleAlignFrames = (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (selectedFrameIds.size < 2) return;
      setFrames(prev => {
          const sel = prev.filter(f => selectedFrameIds.has(f.id));
          if (sel.length < 2) return prev;
          const minX = Math.min(...sel.map(f => f.x));
          const maxX = Math.max(...sel.map(f => f.x + f.width));
          const minY = Math.min(...sel.map(f => f.y));
          const maxY = Math.max(...sel.map(f => f.y + f.height));
          const cX = (minX + maxX) / 2;
          const cY = (minY + maxY) / 2;
          return prev.map(f => {
              if (!selectedFrameIds.has(f.id)) return f;
              let { x, y } = f;
              if (align === 'left') x = minX;
              else if (align === 'center') x = cX - f.width / 2;
              else if (align === 'right') x = maxX - f.width;
              else if (align === 'top') y = minY;
              else if (align === 'middle') y = cY - f.height / 2;
              else if (align === 'bottom') y = maxY - f.height;
              return { ...f, x, y };
          });
      });
  };

  const calculateAutoLayout = (currentFrames: FrameData[]) => {
      if (currentFrames.length === 0) return currentFrames;
      
      const cW = canvasSize.width;
      const cH = canvasSize.height;
      const GAP = 2; // 2cm gap
      const PADDING = 5; // 5cm padding
      
      const items = currentFrames.map(f => ({ 
          ...f, 
          wCm: (f.width / 100) * cW, 
          hCm: (f.height / 100) * cH,
          cx: ((f.x + f.width/2) / 100) * cW,
          cy: ((f.y + f.height/2) / 100) * cH
      }));
      
      // Sort by visual grid position with tolerance for slight vertical misalignment
      const ROW_THRESHOLD = 15; // Increased threshold to robustly group slightly misaligned rows
      items.sort((a, b) => {
          if (Math.abs(a.cy - b.cy) < ROW_THRESHOLD) {
              return a.cx - b.cx;
          }
          return a.cy - b.cy;
      });

      const rows: { items: typeof items, w: number, h: number }[] = [];
      let currentRow: typeof items = [];
      let currentRowWidth = 0;
      let currentRowHeight = 0;

      items.forEach((item, index) => {
          let addToCurrent = false;
          if (index === 0) {
              addToCurrent = true;
          } else {
              // Group into the same row if vertical position is close to the previous item
              // This preserves the row structure even if widths change dramatically
              const prev = items[index - 1];
              if (Math.abs(item.cy - prev.cy) < ROW_THRESHOLD) {
                  addToCurrent = true;
              }
          }

          if (addToCurrent) {
              if (currentRow.length > 0) currentRowWidth += GAP;
              currentRow.push(item);
              currentRowWidth += item.wCm;
              currentRowHeight = Math.max(currentRowHeight, item.hCm);
          } else {
              rows.push({ items: currentRow, w: currentRowWidth, h: currentRowHeight });
              currentRow = [item];
              currentRowWidth = item.wCm;
              currentRowHeight = item.hCm;
          }
      });
      if (currentRow.length > 0) rows.push({ items: currentRow, w: currentRowWidth, h: currentRowHeight });

      const totalContentHeight = rows.reduce((sum, r) => sum + r.h, 0) + (Math.max(0, rows.length - 1) * GAP);
      let currentY = Math.max(PADDING, (cH - totalContentHeight) / 2);

      const newFrames = [...currentFrames];
      
      rows.forEach(row => {
          let currentX = (cW - row.w) / 2;
          row.items.forEach(item => {
              const frameIndex = newFrames.findIndex(f => f.id === item.id);
              if (frameIndex !== -1) {
                  const yOffset = (row.h - item.hCm) / 2;
                  newFrames[frameIndex] = { 
                      ...newFrames[frameIndex], 
                      x: (currentX / cW) * 100, 
                      y: ((currentY + yOffset) / cH) * 100,
                      width: (item.wCm / cW) * 100,
                      height: (item.hCm / cH) * 100
                  };
              }
              currentX += item.wCm + GAP;
          });
          currentY += row.h + GAP;
      });
      
      return newFrames;
  };

  const handleAutoArrange = () => {
      setFrames(prev => calculateAutoLayout(prev));
  };
  
  const handleZoomIn = () => setZoom(p => Math.min(p + 0.1, 2.5));
  const handleZoomOut = () => setZoom(p => Math.max(p - 0.1, 0.2));
  
  const handleSwapFrames = (sId: string, tId: string) => {
      const sKey = sId.startsWith('custom') ? sId : `${currentLayoutConfig.id}-${sId}`;
      const tKey = tId.startsWith('custom') ? tId : `${currentLayoutConfig.id}-${tId}`;
      setImages(p => {
          const n = { ...p };
          const sI = p[sKey], tI = p[tKey];
          if (sI) n[tKey] = sI; else delete n[tKey];
          if (tI) n[sKey] = tI; else delete n[sKey];
          return n;
      });
      updateFrame(sId, { rotation: 0, fitMode: 'cover' });
      updateFrame(tId, { rotation: 0, fitMode: 'cover' });
      if (selectedFrameIds.has(sId)) setSelectedFrameIds(new Set([tId]));
  };

  const handleRotateFrame = (id: string) => {
      setFrames(prev => {
          const copy = prev.map(f => ({...f}));
          const tIdx = copy.findIndex(f => f.id === id);
          if (tIdx === -1) return prev;
          const target = copy[tIdx];
          const oldW = target.width, oldH = target.height;
          const cRatio = canvasSize.width / canvasSize.height;
          const newW = oldH / cRatio;
          const newH = oldW * cRatio;
          
          target.width = newW;
          target.height = newH;

          if (target.size === FrameSize.S20x30) target.size = FrameSize.S30x20;
          else if (target.size === FrameSize.S30x20) target.size = FrameSize.S20x30;
          
          return calculateAutoLayout(copy);
      });
  };

  const handleResetLayout = () => {
    const scaleX = currentLayoutConfig.totalWidthCm / canvasSize.width;
    const scaleY = currentLayoutConfig.totalHeightCm / canvasSize.height;
    const offsetX = (100 - (100 * scaleX)) / 2;
    const offsetY = 5; 
    setFrames(prev => prev.map(f => {
        const std = currentLayoutConfig.frames.find(sf => sf.id === f.id);
        if (std) {
            return {
                ...f,
                size: std.size,
                x: (std.x * scaleX) + offsetX,
                y: (std.y * scaleY) + offsetY,
                width: std.width * scaleX,
                height: std.height * scaleY,
                rotation: 0,
                fitMode: 'cover',
                groupId: undefined
            };
        }
        return f;
    }));
  };

  const handleSave = async () => {
    if (!containerRef.current) return;
    setIsSaving(true);
    const prevZoom = zoom;
    const prevSel = new Set(selectedFrameIds);
    const prevLocked = isLayoutLocked;
    try {
        setZoom(1);
        setSelectedFrameIds(new Set());
        setIsLayoutLocked(true);
        await new Promise(r => setTimeout(r, 500));
        const dataUrl = await toPng(containerRef.current, { cacheBust: false, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `wall-art-planner-${new Date().toISOString().slice(0,10)}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) { alert('Failed to download image.'); } finally {
        setZoom(prevZoom);
        setSelectedFrameIds(prevSel);
        setIsLayoutLocked(prevLocked);
        setIsSaving(false);
    }
  };
  
  const aspectRatio = canvasSize.width / canvasSize.height;
  const activeFrameId = selectedFrameIds.size === 1 ? Array.from(selectedFrameIds)[0] : null;
  const activeFrame = activeFrameId ? frames.find(f => f.id === activeFrameId) : null;
  const activeUnique = activeFrame ? (activeFrame.id.startsWith('custom') ? activeFrame.id : `${currentLayoutConfig.id}-${activeFrame.id}`) : null;

  // REMOVE SIDEBAR WIDTH RESERVATION TO PREVENT ZOOM OUT
  const availableWidth = Math.max(100, containerDims.width);
  const availableHeight = Math.max(100, containerDims.height);
  
  const maxWidth = availableWidth * 0.95;
  const maxHeight = availableHeight * 0.95;
  
  let finalW, finalH;
  const wBasedH = maxWidth / aspectRatio;
  if (wBasedH <= maxHeight) {
      finalW = maxWidth;
      finalH = wBasedH;
  } else {
      finalH = maxHeight;
      finalW = finalH * aspectRatio;
  }
  
  finalW *= zoom;
  finalH *= zoom;

  const SidebarContent = () => (
    <>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <Scissors size={18} className="text-indigo-600" />
                Edit Photo
            </h2>
            <button onClick={clearSelection} className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
                <X size={20}/>
            </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeUnique && images[activeUnique] ? (
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Tools</label>
                    <div className="grid grid-cols-1 gap-2">
                        <button onClick={() => activeUnique && handleCropRequest(activeFrame!.id, activeUnique)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 text-gray-700 text-sm font-medium transition-all border border-gray-100 hover:border-indigo-200 group">
                            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Scissors size={16}/></div> 
                            Crop Image
                        </button>
                        <button onClick={() => activeUnique && handleRotateImageContent(activeUnique)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 text-gray-700 text-sm font-medium transition-all border border-gray-100 hover:border-orange-200 group">
                            <div className="bg-orange-100 text-orange-600 p-2 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors"><RotateCw size={16}/></div> 
                            Rotate 90°
                        </button>
                        <button onClick={() => replaceFileRef.current?.click()} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-gray-700 text-sm font-medium transition-all border border-gray-100 hover:border-blue-200 group">
                            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Upload size={16}/></div> 
                            Replace Photo
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <Images size={40} className="mb-3 opacity-20" />
                    <p className="text-xs font-semibold uppercase tracking-wider">Empty Frame</p>
                    <button onClick={() => replaceFileRef.current?.click()} className="mt-5 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">Upload Photo</button>
                </div>
            )}
            <div className="border-t border-gray-100 pt-6">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-4">Frame Options</label>
                <div className="space-y-2">
                    {activeFrame?.size !== '20x20cm' && (
                        <button onClick={() => handleRotateFrame(activeFrame!.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 text-gray-700 text-sm font-medium transition-all border border-transparent">
                            <div className="bg-gray-200 text-gray-600 p-2 rounded-lg"><ArrowLeftRight size={16}/></div> 
                            Flip Orientation
                        </button>
                    )}
                    <button onClick={() => activeUnique && handleRemoveFrame(activeFrame!.id, activeUnique)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-red-600 text-sm font-medium transition-all border border-transparent">
                        <div className="bg-red-100 text-red-500 p-2 rounded-lg"><Trash2 size={16}/></div> 
                        {activeFrame?.id.startsWith('custom') ? 'Delete Frame' : 'Remove Photo'}
                    </button>
                </div>
            </div>
        </div>
        <input type="file" ref={replaceFileRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0] && activeUnique) handleImageUpload(activeUnique, e.target.files[0]); if (replaceFileRef.current) replaceFileRef.current.value = ''; }} />
    </>
  );

  return (
    <div className="h-screen bg-gray-50 text-slate-800 font-sans flex flex-col overflow-hidden select-none">
      <header className="bg-white border-b border-gray-200 z-[60] flex-none h-16 shadow-sm">
        <div className="max-w-full mx-auto px-4 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
                <Camera className="text-white" size={20} />
            </div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 hidden lg:block">
              WallArt<span className="text-indigo-600">Planner</span>
            </h1>
          </div>
          
          <div className="flex gap-1.5 md:gap-2 items-center">
             <input type="file" ref={customFileRef} className="hidden" accept="image/*" onChange={handleAddCustomPhoto} />
             <input type="file" ref={bulkFileRef} className="hidden" multiple accept="image/*" onChange={handleBulkUpload} />
             <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
             
             <button onClick={() => wallImage ? handleRemoveBg() : bgInputRef.current?.click()} className="flex items-center justify-center w-10 h-10 md:w-auto md:px-3 text-sm font-bold rounded-xl transition-all border text-gray-700 bg-white border-gray-200 hover:bg-gray-50 active:scale-95">
                {wallImage ? <Trash2 size={18} /> : <Wallpaper size={18} />}
                <span className="ml-2 hidden lg:inline">Wall Background</span>
             </button>
             
             <button onClick={() => setIsGalleryOpen(true)} className="flex items-center justify-center w-10 h-10 md:w-auto md:px-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-all active:scale-95">
                <Grid size={18} /> <span className="ml-2 hidden lg:inline">Gallery</span>
             </button>
             
             <button onClick={() => bulkFileRef.current?.click()} className="flex items-center justify-center w-10 h-10 md:w-auto md:px-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-all active:scale-95">
                 <Images size={18} /> <span className="ml-2 hidden lg:inline">Bulk Upload</span>
             </button>

             <div className="relative">
                <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className="flex items-center justify-center w-10 h-10 md:w-auto md:px-3 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all border border-indigo-100 active:scale-95">
                    <ImagePlus size={18} /> <span className="ml-2 hidden lg:inline">Add Frame</span> <ChevronDown size={14} className={`ml-1 transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isAddMenuOpen && (
                   <>
                       <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)}></div>
                       <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                           <div className="p-4 text-[10px] font-black text-gray-400 bg-gray-50 border-b border-gray-100 uppercase tracking-widest">Select Frame Size</div>
                           <button onClick={() => handleAddOptionClick(FrameSize.S20x20)} className="w-full text-left px-5 py-4 text-sm font-bold hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50">20x20cm Square</button>
                           <button onClick={() => handleAddOptionClick(FrameSize.S20x30)} className="w-full text-left px-5 py-4 text-sm font-bold hover:bg-indigo-50 hover:text-indigo-700 transition-colors">20x30cm Portrait</button>
                       </div>
                   </>
                )}
             </div>

             <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
             
             <button onClick={handleSave} disabled={isSaving} className="flex items-center justify-center h-10 px-4 md:px-5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50">
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
              <span className="ml-2 hidden sm:inline">{isSaving ? 'Saving...' : 'Download'}</span>
             </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <main ref={mainContainerRef} className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col">
             <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0 z-40 shadow-sm overflow-x-auto no-scrollbar">
                 <div className="flex items-center gap-2 min-w-max">
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                        {LAYOUTS.map(l => (
                            <button key={l.id} onClick={() => setActiveLayoutId(l.id)} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeLayoutId === l.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{l.name}</button>
                        ))}
                    </div>
                    
                    <div className="h-4 w-px bg-gray-300 mx-1"></div>
                    
                    <div className="flex items-center gap-1.5">
                         <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                             <span className="text-[10px] text-gray-400 font-black">W</span>
                             <input type="number" className="w-9 text-xs font-bold bg-transparent focus:outline-none text-right" value={canvasSize.width} onChange={(e) => handleDimensionsChange(parseInt(e.target.value) || 0, canvasSize.height)} />
                             <span className="text-[10px] text-gray-400">cm</span>
                         </div>
                         <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                             <span className="text-[10px] text-gray-400 font-black">H</span>
                             <input type="number" className="w-9 text-xs font-bold bg-transparent focus:outline-none text-right" value={canvasSize.height} onChange={(e) => handleDimensionsChange(canvasSize.width, parseInt(e.target.value) || 0)} />
                             <span className="text-[10px] text-gray-400">cm</span>
                         </div>
                    </div>

                    <div className="h-4 w-px bg-gray-300 mx-1"></div>
                    
                    <button onClick={() => setIsLayoutLocked(!isLayoutLocked)} className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl transition-all border whitespace-nowrap ${!isLayoutLocked ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {isLayoutLocked ? <Lock size={14} /> : <Unlock size={14} />} 
                        <span className="hidden sm:inline">{isLayoutLocked ? 'Locked' : 'Unlocked'}</span>
                    </button>
                    
                    <button onClick={handleAutoArrange} className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl transition-all bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100"><LayoutDashboard size={14} /> <span className="hidden lg:inline">Auto Arrange</span></button>
                    <button onClick={handleResetLayout} className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl transition-all bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200"><RotateCcw size={14} /></button>
                 </div>
                 
                 <div className="flex items-center gap-1 md:gap-2 bg-gray-50 rounded-xl p-1 ml-4 border border-gray-200">
                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-white rounded-lg text-gray-500 transition-all"><ZoomOut size={16}/></button>
                    <span className="text-[10px] font-black w-10 text-center text-gray-600 tracking-tighter">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-white rounded-lg text-gray-500 transition-all"><ZoomIn size={16}/></button>
                 </div>
             </div>

             <div className="flex-1 overflow-auto bg-wall relative" onMouseDown={handleContainerMouseDown}>
                <div className="min-h-full min-w-full flex items-center justify-center p-6 md:p-12">
                    <div 
                        ref={containerRef}
                        className="relative bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] transition-all duration-500 ease-out origin-center"
                        style={{
                            width: finalW ? `${finalW}px` : 'auto',
                            height: finalH ? `${finalH}px` : 'auto',
                            backgroundImage: wallImage ? `url(${wallImage})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    >
                        {!wallImage && <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-gray-100/50 pointer-events-none" />}
                        {wallImage && <div className="absolute inset-0 bg-black/10 pointer-events-none" />}

                        {frames.map((frame) => {
                            const isCustom = frame.id.startsWith('custom');
                            const uniqueFrameId = isCustom ? frame.id : `${currentLayoutConfig.id}-${frame.id}`;
                            const isSelected = selectedFrameIds.has(frame.id);

                            return (
                                <PhotoFrame
                                    key={uniqueFrameId}
                                    frame={frame}
                                    isCustom={isCustom}
                                    isSelected={isSelected}
                                    imageUrl={images[uniqueFrameId]}
                                    zIndex={zIndices[frame.id] || 0}
                                    rotation={frame.rotation || 0}
                                    isLayoutLocked={isLayoutLocked}
                                    onPositionChange={(x, y) => updateFrame(frame.id, { x, y })}
                                    onFrameDragStart={() => handleFrameDragStart(frame.id)}
                                    onFrameDragMove={(dX, dY) => handleFrameDragMove(frame.id, dX, dY)}
                                    onFrameDragEnd={(fX, fY) => handleFrameDragEnd(frame.id, fX, fY)}
                                    onRef={(el) => frameRefs.current[frame.id] = el}
                                    otherFrames={frames.filter(f => isSelected ? !selectedFrameIds.has(f.id) : f.id !== frame.id)}
                                    onUpload={(file) => handleImageUpload(uniqueFrameId, file)}
                                    onRemove={() => handleRemoveFrame(frame.id, uniqueFrameId)}
                                    onRotateFrame={() => handleRotateFrame(frame.id)}
                                    onSwap={(sourceId) => handleSwapFrames(sourceId, frame.id)}
                                    onSelect={(multi) => toggleSelection(frame.id, multi)}
                                />
                            );
                        })}

                        {marqueeSelection && containerRef.current && (
                           <div 
                              className="absolute bg-indigo-500/10 border-2 border-indigo-500 rounded-sm z-[9999] pointer-events-none"
                              style={{
                                  left: Math.min(marqueeSelection.startX, marqueeSelection.currentX) - containerRef.current.getBoundingClientRect().left,
                                  top: Math.min(marqueeSelection.startY, marqueeSelection.currentY) - containerRef.current.getBoundingClientRect().top,
                                  width: Math.abs(marqueeSelection.currentX - marqueeSelection.startX),
                                  height: Math.abs(marqueeSelection.currentY - marqueeSelection.startY)
                              }}
                           />
                        )}
                    </div>
                </div>
             </div>
          </main>

          {activeFrame && (
             isMobile ? (
                /* Mobile Bottom Sheet Drawer */
                <div className="fixed inset-0 z-[70] bg-black/20 md:hidden backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={clearSelection}></div>
                    <aside className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.1)] flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 shrink-0"></div>
                        <SidebarContent />
                    </aside>
                </div>
             ) : (
                /* Desktop Side Panel */
                <aside className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl z-20 animate-in slide-in-from-right duration-300">
                    <SidebarContent />
                </aside>
             )
          )}
      </div>

      {isGalleryOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <Grid size={28} className="text-indigo-600" /> 
                        Your Gallery
                    </h2>
                    <button onClick={() => setIsGalleryOpen(false)} className="p-3 hover:bg-gray-100 rounded-full text-gray-500 transition-all"><X size={28} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50/50">
                      {imageLibrary.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-gray-300">
                              <Images size={64} className="mb-6 opacity-10" />
                              <p className="text-xl font-black uppercase tracking-widest text-gray-300">No uploads found</p>
                              <p className="text-sm mt-2 text-gray-400 font-medium">Add photos to your workspace to populate your library.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                              {imageLibrary.map((url, index) => (
                                  <button key={index} onClick={() => handleSelectFromGallery(url)} className="group relative aspect-square rounded-2xl overflow-hidden shadow-lg border-4 border-transparent hover:border-indigo-600 focus:outline-none focus:ring-8 focus:ring-indigo-100 transition-all active:scale-95">
                                    <img src={url} alt={`Library ${index}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors" />
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {croppingSession && <ImageCropper imageUrl={croppingSession.url} aspectRatio={croppingSession.aspectRatio} onCancel={() => setCroppingSession(null)} onCrop={handleCropSave} />}
    </div>
  );
};

export default App;