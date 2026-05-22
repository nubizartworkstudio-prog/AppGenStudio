import React, { useState, useEffect, useRef } from 'react';
// Import Pencil icon from lucide-react to fix the reference error
import { Pencil } from 'lucide-react';
import { PreviewDevice, Orientation } from '../types';

interface PreviewFrameProps {
  code: string;
  device: PreviewDevice;
  orientation: Orientation;
  isRealtimeEditMode?: boolean;
  onElementClick?: (data: any) => void;
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({ 
  code, 
  device, 
  orientation, 
  isRealtimeEditMode = false,
  onElementClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const isLandscape = orientation === 'landscape';

  // Use a ref to track edit mode state so the click listener inside the iframe 
  // always has access to the latest value without relying on closure updates.
  const isEditModeRef = useRef(isRealtimeEditMode);
  useEffect(() => {
    isEditModeRef.current = isRealtimeEditMode;
  }, [isRealtimeEditMode]);

  const getDimensions = () => {
    switch (device) {
      case PreviewDevice.MOBILE:
        return isLandscape 
          ? { width: 667, height: 375 } 
          : { width: 375, height: 667 };
      case PreviewDevice.DESKTOP:
      default:
        return null;
    }
  };

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current || device === PreviewDevice.DESKTOP) {
        setScale(1);
        return;
      }

      const dimensions = getDimensions();
      if (!dimensions) return;

      const isSmallScreen = window.innerWidth < 768;
      const horizontalMargin = isSmallScreen ? 32 : 40;
      // Adjusted vertical margin to match the new smaller padding (pt-4 + pb-4/6)
      const verticalMargin = isSmallScreen ? 48 : 56; 
      
      const containerWidth = containerRef.current.offsetWidth - horizontalMargin;
      const containerHeight = containerRef.current.offsetHeight - verticalMargin;
      
      const borderWidth = isSmallScreen ? 6 : 12;
      const bezelSize = borderWidth * 2; 
      
      const targetWidth = dimensions.width + bezelSize;
      const targetHeight = dimensions.height + bezelSize;

      const scaleW = containerWidth / targetWidth;
      const scaleH = containerHeight / targetHeight;
      
      let newScale = Math.min(scaleW, scaleH);
      const maxCap = isSmallScreen ? 1.0 : 1.5;
      setScale(Math.max(Math.min(newScale, maxCap), 0.2));
    };

    updateScale();
    const timer = setTimeout(updateScale, 200);
    
    window.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, [device, orientation, code]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cleanupCurrentDoc: (() => void) | null = null;

    const setupListeners = () => {
      // Clean up previous document listeners if they exist
      if (cleanupCurrentDoc) {
        cleanupCurrentDoc();
        cleanupCurrentDoc = null;
      }

      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;

      const styleId = 'studio-edit-mode-styles';
      
      // Helper function to remove attributes and styles
      const removeEditAssets = () => {
        const styleEl = doc.getElementById(styleId);
        if (styleEl) styleEl.remove();
        const allElements = doc.body.querySelectorAll('[data-studio-edit-active]');
        allElements.forEach(el => el.removeAttribute('data-studio-edit-active'));
      };

      if (isRealtimeEditMode) {
        let styleEl = doc.getElementById(styleId);
        if (!styleEl) {
          styleEl = doc.createElement('style');
          styleEl.id = styleId;
          styleEl.textContent = `
            [data-studio-edit-active] {
              outline: 2px dashed #f59e0b !important;
              outline-offset: 2px !important;
              cursor: crosshair !important;
              transition: outline 0.1s ease !important;
            }
            [data-studio-edit-active]:hover {
              outline: 2px solid #f59e0b !important;
              background-color: rgba(245, 158, 11, 0.05) !important;
              z-index: 10000 !important;
            }
          `;
          doc.head.appendChild(styleEl);
        }

        const allElements = doc.body.querySelectorAll('*');
        allElements.forEach(el => el.setAttribute('data-studio-edit-active', 'true'));
      } else {
        removeEditAssets();
      }

      const handleClick = (e: MouseEvent) => {
        // ALWAYS check the ref to ensure we don't trigger if mode was just disabled
        if (!isEditModeRef.current) return;
        
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        if (!target) return;

        const computedStyle = window.getComputedStyle(target);
        
        // Extract all style and script tags from the document
        const cssContent = Array.from(doc.querySelectorAll('style'))
          .filter(s => (s as HTMLElement).id !== styleId)
          .map(s => (s as HTMLElement).textContent)
          .join('\n')
          .trim();
        
        const jsContent = Array.from(doc.querySelectorAll('script'))
          .map(s => (s as HTMLElement).textContent)
          .join('\n')
          .trim();
        
        const data = {
          tagName: target.tagName,
          textContent: target.textContent || '',
          fontSize: computedStyle.fontSize,
          fontFamily: computedStyle.fontFamily,
          href: (target as HTMLAnchorElement).href || undefined,
          src: (target as HTMLImageElement).src || undefined,
          elementRef: target,
          outerHTML: target.outerHTML,
          css: cssContent,
          js: jsContent
        };

        if (onElementClick) {
          onElementClick(data);
        }
      };

      doc.addEventListener('click', handleClick, true);
      cleanupCurrentDoc = () => {
        doc.removeEventListener('click', handleClick, true);
        removeEditAssets();
      };
    };

    iframe.addEventListener('load', setupListeners);
    // Initial setup if doc is already ready
    setupListeners(); 

    return () => {
      iframe.removeEventListener('load', setupListeners);
      if (cleanupCurrentDoc) cleanupCurrentDoc();
    };
  }, [isRealtimeEditMode, onElementClick, code]);

  const dims = getDimensions();

  return (
    <div 
      ref={containerRef}
      className={`flex items-center justify-center w-full h-full bg-gray-100/50 overflow-hidden ${
        device === PreviewDevice.DESKTOP ? 'p-0' : 'px-4 pt-4 pb-4 md:pb-6'
      }`}
    >
      <div 
        className={`relative transition-all duration-500 ease-in-out shadow-2xl bg-white overflow-hidden shrink-0 border-gray-900 ${
          isRealtimeEditMode ? 'ring-4 ring-amber-400 ring-offset-4' : ''
        }`}
        style={{ 
          width: device === PreviewDevice.DESKTOP ? '100%' : dims?.width, 
          height: device === PreviewDevice.DESKTOP ? '100%' : dims?.height,
          transform: device === PreviewDevice.DESKTOP ? 'none' : `scale(${scale})`,
          transformOrigin: 'center center',
          borderWidth: device === PreviewDevice.DESKTOP ? '0' : (window.innerWidth < 768 ? '6px' : '12px'),
          borderRadius: device === PreviewDevice.DESKTOP ? '0' : (window.innerWidth < 768 ? '1.5rem' : '3rem')
        }}
      >
        {device !== PreviewDevice.DESKTOP && (
          <div className={`absolute bg-gray-900 z-10 transition-all duration-300 ${
            isLandscape 
            ? 'top-1/2 -left-1 -translate-y-1/2 h-12 w-2 md:h-16 md:w-3 rounded-r-lg opacity-80' 
            : '-top-1 left-1/2 -translate-x-1/2 w-20 h-3 md:w-32 md:h-5 rounded-b-xl md:rounded-b-2xl opacity-80'
          }`}>
            {!isLandscape && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-0.5 md:h-1 md:w-8 bg-gray-700 rounded-full"></div>
            )}
          </div>
        )}

        <iframe
          ref={iframeRef}
          srcDoc={code}
          title="App Preview"
          className="w-full h-full border-none bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        />
        
        {isRealtimeEditMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 animate-pulse pointer-events-none z-50">
            <Pencil size={12} />
            Realtime Edit Active - Click to Edit
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewFrame;