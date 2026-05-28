// Fixed corrupted imports and removed duplicate type definitions from the top of the file
import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Plus, 
  Settings, 
  Sparkles, 
  Copy, 
  Trash2, 
  Check, 
  X, 
  MessageSquare, 
  ArrowRight, 
  Layout, 
  Layers, 
  Zap, 
  Menu, 
  Cpu, 
  ZapOff, 
  User, 
  ChevronUp, 
  ExternalLink, 
  ShieldCheck, 
  BarChart3, 
  Info, 
  Loader2, 
  CornerDownRight, 
  Type, 
  Search, 
  AlertTriangle, 
  Pencil, 
  Activity, 
  Square, 
  BarChart,
  Save,
  RefreshCw,
  BellRing,
  FileCode,
  FileText,
  Clock,
  Image as ImageIcon,
  Upload,
  File,
  Music,
  Video,
  Link as LinkIcon,
  Maximize2,
  Code,
  Download,
  Keyboard,
  History,
  Clipboard,
  Eye,
  EyeOff,
  Key
} from 'lucide-react';
import { PreviewDevice, GeneratedProject, ViewMode, Orientation } from './types';
import { generateAppCode } from './services/geminiService';
import PreviewFrame from './components/PreviewFrame';

interface EditElementData {
  tagName: string;
  textContent: string;
  fontSize: string;
  fontFamily: string;
  href?: string;
  src?: string;
  elementRef: HTMLElement;
  outerHTML: string;
  css: string;
  js: string;
}

const App: React.FC = () => {
  // Synchronously load the history and active project on mount to initialize the states consistently
  const initialHistory = (() => {
    try {
      const saved = localStorage.getItem('ai_studio_history_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed as GeneratedProject[];
        }
      }
    } catch (e) {
      console.error("Failed to parse history from localStorage", e);
    }
    return [] as GeneratedProject[];
  })();

  const initialActiveProjectId = (() => {
    try {
      const savedActiveId = localStorage.getItem('ai_studio_active_project_id');
      if (initialHistory && initialHistory.length > 0) {
        if (savedActiveId && initialHistory.some(p => p && p.id === savedActiveId)) {
          return savedActiveId;
        }
        return initialHistory[0].id; // Default to latest project in history
      }
    } catch (e) {
      console.error("Failed to parse active project ID from localStorage", e);
    }
    return null;
  })();

  const initialActiveProject = Array.isArray(initialHistory) 
    ? initialHistory.find(p => p && p.id === initialActiveProjectId) 
    : undefined;

  const initialProjectTitle = (() => {
    if (initialActiveProject) {
      const rootProj = initialActiveProject.parentId 
        ? initialHistory.find(p => p && p.id === initialActiveProject.parentId) || initialActiveProject
        : initialActiveProject;
      return rootProj.name || '';
    }
    return '';
  })();

  const [projectTitle, setProjectTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [code, setCode] = useState('');
  const [editableCode, setEditableCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('build');
  const [device, setDevice] = useState<PreviewDevice>(PreviewDevice.DESKTOP);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [history, setHistory] = useState<GeneratedProject[]>(initialHistory);
  const [copied, setCopied] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [showRefineSidebar, setShowRefineSidebar] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const savedModel = localStorage.getItem('ai_studio_selected_model');
      if (savedModel) {
        if (savedModel.startsWith('gpt') || savedModel.includes('2.5') || savedModel.includes('3.1-flash-lite-preview')) {
          return 'gemini-3.5-flash';
        }
        return savedModel;
      }
    } catch (e) {
      console.warn("Failed to get selected model from localStorage", e);
    }
    return 'gemini-3.5-flash';
  });
  const [previewKey, setPreviewKey] = useState(0);
  const [submitKeyShortcut, setSubmitKeyShortcut] = useState<'ctrl-enter' | 'enter'>(() => {
    try {
      const savedShortcut = localStorage.getItem('ai_studio_submit_shortcut');
      return (savedShortcut === 'ctrl-enter' || savedShortcut === 'enter') ? savedShortcut : 'ctrl-enter';
    } catch (e) {
      console.warn("Failed to get submit shortcut from localStorage", e);
    }
    return 'ctrl-enter';
  });
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState<boolean>(() => {
    try {
      const savedAutosave = localStorage.getItem('ai_studio_autosave_enabled');
      return savedAutosave !== null ? savedAutosave === 'true' : true;
    } catch (e) {
      console.warn("Failed to get autosave flag from localStorage", e);
    }
    return true;
  });
  const [lastAutosave, setLastAutosave] = useState<number | null>(null);

  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('ai_studio_api_key') || '';
    } catch (e) {
      console.warn("Failed to get API key from localStorage", e);
    }
    return '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKeyPromptModal, setShowApiKeyPromptModal] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('ai_studio_api_key');
    } catch (e) {
      console.warn("Failed to check API key in localStorage", e);
    }
    return true;
  });
  
  // Realtime Edit State
  const [isRealtimeEditMode, setIsRealtimeEditMode] = useState(false);
  const [activeEditElement, setActiveEditElement] = useState<EditElementData | null>(null);
  
  // Generic File Upload State
  const [selectedFile, setSelectedFile] = useState<{ data: string, mimeType: string, name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refineFileInputRef = useRef<HTMLInputElement>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Renaming state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Overwrite state
  const [overwriteCandidate, setOverwriteCandidate] = useState<GeneratedProject | null>(null);

  // Delete confirmation state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);

  // Abort Controller for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ai_studio_history_v2', JSON.stringify(history));
    } catch (e) {
      console.warn("Failed to write history to localStorage", e);
    }
  }, [history]);

  useEffect(() => {
    try {
      if (activeProjectId) {
        localStorage.setItem('ai_studio_active_project_id', activeProjectId);
      } else {
        localStorage.removeItem('ai_studio_active_project_id');
      }
    } catch (e) {
      console.warn("Failed to write active project ID to localStorage", e);
    }
  }, [activeProjectId]);

  useEffect(() => {
    try {
      localStorage.setItem('ai_studio_selected_model', selectedModel);
    } catch (e) {
      console.warn("Failed to write selected model to localStorage", e);
    }
  }, [selectedModel]);

  useEffect(() => {
    try {
      localStorage.setItem('ai_studio_submit_shortcut', submitKeyShortcut);
    } catch (e) {
      console.warn("Failed to write submit shortcut to localStorage", e);
    }
  }, [submitKeyShortcut]);

  useEffect(() => {
    try {
      localStorage.setItem('ai_studio_autosave_enabled', isAutosaveEnabled.toString());
    } catch (e) {
      console.warn("Failed to write autosave flag to localStorage", e);
    }
  }, [isAutosaveEnabled]);

  useEffect(() => {
    try {
      if (customApiKey) {
        localStorage.setItem('ai_studio_api_key', customApiKey);
      } else {
        localStorage.removeItem('ai_studio_api_key');
      }
    } catch (e) {
      console.warn("Failed to write API key to localStorage", e);
    }
  }, [customApiKey]);

  // Autosave logic
  useEffect(() => {
    if (!isAutosaveEnabled || !activeProjectId || isGenerating) return;

    const timeout = setTimeout(() => {
      setHistory(prev => {
        const project = prev.find(p => p.id === activeProjectId);
        if (!project) return prev;
        
        // Only update if something actually changed to prevent excessive writes
        if (project.code === code && project.name === projectTitle && project.prompt === prompt) {
          return prev;
        }

        const updatedHistory = prev.map(p => 
          p.id === activeProjectId 
            ? { ...p, code, name: p.parentId ? p.name : (projectTitle || p.name), prompt, timestamp: Date.now() } 
            : p
        );
        setLastAutosave(Date.now());
        return updatedHistory;
      });
    }, 10000); // Autosave after 10 seconds of no changes

    return () => clearTimeout(timeout);
  }, [code, projectTitle, prompt, activeProjectId, isAutosaveEnabled, isGenerating]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setSelectedFile({
        data: base64String,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const triggerRefineUpload = () => {
    refineFileInputRef.current?.click();
  };

  const handleCreateBlankProject = () => {
    const blankBoilerplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blank Project</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #ffffff; min-height: 100vh; font-family: sans-serif; }
    </style>
</head>
<body>
    <div class="flex items-center justify-center min-h-screen">
        <p class="text-gray-400 font-medium italic">Empty Canvas</p>
    </div>
</body>
</html>`;

    const newProjectId = Date.now().toString();
    const newProject: GeneratedProject = {
      id: newProjectId,
      name: "Blank Project",
      prompt: "Started with a blank template",
      code: blankBoilerplate,
      timestamp: Date.now()
    };

    setProjectTitle("Blank Project");
    setPrompt("");
    setCode(blankBoilerplate);
    setEditableCode(blankBoilerplate);
    setHistory(prev => {
      const next = [newProject, ...prev];
      try {
        localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save history in handleCreateBlankProject", e);
      }
      return next;
    });
    setActiveProjectId(newProjectId);
    setViewMode('preview');
    setIsMobileMenuOpen(false);
    setPreviewKey(k => k + 1);
  };

  const saveToSimulatedFS = (title: string, appCode: string, appPrompt: string) => {
    const basePath = `App Gen Studio/${title.trim()}`;
    localStorage.setItem(`${basePath}/index.html`, appCode);
    localStorage.setItem(`${basePath}/metadata.json`, JSON.stringify({
      name: title.trim(),
      prompt: appPrompt,
      timestamp: Date.now()
    }));
  };

  const triggerFileDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmOverwrite = () => {
    if (!overwriteCandidate) return;
    setHistory(prev => {
      const next = prev.map(p => p.id === overwriteCandidate.id ? { ...p, code, prompt, timestamp: Date.now() } : p);
      try {
        localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save history in handleConfirmOverwrite", e);
      }
      return next;
    });
    setActiveProjectId(overwriteCandidate.id);
    saveToSimulatedFS(projectTitle, code, prompt);
    triggerFileDownload(projectTitle, code);
    setOverwriteCandidate(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSaveProject = () => {
    if (!projectTitle.trim() || !code) return;
    const existingProject = history.find(p => p.name.toLowerCase() === projectTitle.toLowerCase() && !p.parentId);
    if (existingProject && existingProject.id !== activeProjectId) {
      setOverwriteCandidate(existingProject);
    } else if (activeProjectId) {
      setHistory(prev => {
        const next = prev.map(p => p.id === activeProjectId ? { ...p, name: p.parentId ? p.name : projectTitle.trim(), code, prompt, timestamp: Date.now() } : p);
        try {
          localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save history in handleSaveProject update", e);
        }
        return next;
      });
      saveToSimulatedFS(projectTitle, code, prompt);
      triggerFileDownload(projectTitle, code);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } else {
      const newProjectId = Date.now().toString();
      const newProject: GeneratedProject = {
        id: newProjectId,
        name: projectTitle.trim(),
        prompt: prompt,
        code: code,
        timestamp: Date.now()
      };
      setHistory(prev => {
        const next = [newProject, ...prev];
        try {
          localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save history in handleSaveProject new", e);
        }
        return next;
      });
      setActiveProjectId(newProjectId);
      saveToSimulatedFS(projectTitle, code, prompt);
      triggerFileDownload(projectTitle, code);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleGenerate = async (isRefinement = false) => {
    const activePrompt = isRefinement ? refinePrompt : prompt;
    if (!activePrompt.trim()) return;
    if (!isRefinement && !projectTitle.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setQuotaExhausted(false);
    
    if (isRefinement) {
      setShowRefineSidebar(false);
    } else if (window.innerWidth < 768) {
      setShowRefineSidebar(false);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const result = await generateAppCode(
        activePrompt, 
        selectedModel, 
        isRefinement ? code : undefined,
        controller.signal,
        selectedFile || undefined
      );
      
      const currentActive = history.find(p => p.id === activeProjectId);
      const parentId = isRefinement ? (currentActive?.parentId || activeProjectId || undefined) : undefined;

      const newProjectId = Date.now().toString();
      const newProject: GeneratedProject = {
        id: newProjectId,
        name: isRefinement 
          ? `Refined: ${activePrompt.substring(0, 20)}...` 
          : projectTitle.trim(),
        prompt: activePrompt,
        code: result.code,
        timestamp: Date.now(),
        parentId: parentId
      };
      
      setCode(result.code);
      setEditableCode(result.code);
      setPrompt(activePrompt);
      setHistory(prev => {
        const next = [newProject, ...prev];
        try {
          localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save history in handleGenerate", e);
        }
        return next;
      });
      setActiveProjectId(newProjectId);
      
      if (isRefinement) {
        setRefinePrompt('');
      }
      
      setSelectedFile(null);
      setViewMode('preview');
      setPreviewKey(k => k + 1);
    } catch (err: any) {
      if (err.message === "Generation cancelled by user.") return;
      if (err.message === "QUOTA_EXHAUSTED") setQuotaExhausted(true);
      else setError(err.message || "Something went wrong during generation.");
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const loadFromHistory = (project: GeneratedProject) => {
    const rootTitle = project.parentId 
      ? history.find(p => p.id === project.parentId)?.name || project.name 
      : project.name;
    setProjectTitle(rootTitle);
    setPrompt(project.prompt);
    setCode(project.code);
    setEditableCode(project.code);
    setActiveProjectId(project.id);
    setViewMode('preview');
    setIsMobileMenuOpen(false);
    setPreviewKey(k => k + 1);
  };

  const handleRename = (id: string, newName: string) => {
    if (!newName.trim()) {
      setEditingProjectId(null);
      return;
    }
    setHistory(prev => {
      const next = prev.map(p => p.id === id ? { ...p, name: newName } : p);
      try {
        localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save history in handleRename", e);
      }
      return next;
    });
    if (activeProjectId === id) setProjectTitle(newName);
    setEditingProjectId(null);
  };

  const openDeleteConfirmation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!projectToDeleteId) return;
    const id = projectToDeleteId;
    setHistory(prev => {
      const next = prev.filter(p => p.id !== id && p.parentId !== id);
      try {
        localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save history in confirmDelete", e);
      }
      return next;
    });
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setCode('');
      setEditableCode('');
      setViewMode('build');
    }
    setIsDeleteModalOpen(false);
    setProjectToDeleteId(null);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editableCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearCode = () => {
    setEditableCode('');
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const textarea = codeTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);
        setEditableCode(newVal);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      } else {
        setEditableCode(text);
      }
    } catch (err) {
      console.warn("Failed to read clipboard:", err);
    }
  };

  const handleSelectAllCode = () => {
    const textarea = codeTextareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  };

  const applyManualChanges = () => {
    setCode(editableCode);
    setPreviewKey(k => k + 1);
    if (activeProjectId) {
      setHistory(prev => {
        const next = prev.map(p => p.id === activeProjectId ? { ...p, code: editableCode } : p);
        try {
          localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to save history in applyManualChanges", e);
        }
        return next;
      });
    }
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 2000);
  };

  const handleReloadPreview = () => setPreviewKey(k => k + 1);

  const toggleFullScreen = () => {
    if (!previewContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      previewContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const getModelBadgeInfo = (modelId: string) => {
    const isPro = modelId.includes('pro');
    const isV3 = modelId.includes('gemini-3');
    return {
      label: isPro ? 'Pro' : 'Flash',
      version: isV3 ? 'v3' : 'v2.5',
      className: isPro 
        ? 'bg-purple-100 text-purple-600 border border-purple-200' 
        : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    };
  };

  const toggleRefineSidebar = () => {
    const nextState = !showRefineSidebar;
    setShowRefineSidebar(nextState);
    if (nextState) {
      if (viewMode === 'build' && code) setViewMode('preview');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={18} />;
    if (mimeType.startsWith('audio/')) return <Music size={18} />;
    if (mimeType.startsWith('video/')) return <Video size={18} />;
    if (mimeType.startsWith('text/')) return <FileText size={18} />;
    return <File size={18} />;
  };

  const renderFilePreview = (file: { data: string, mimeType: string, name: string }, size: 'large' | 'small' = 'large') => {
    const isImage = file.mimeType.startsWith('image/');
    const dim = size === 'large' ? 'w-16 h-16' : 'w-8 h-8';
    
    return (
      <div className={`relative ${dim} rounded-xl overflow-hidden border-2 border-blue-50 shadow-lg bg-white flex items-center justify-center`}>
        {isImage ? (
          <img src={`data:${file.mimeType};base64,${file.data}`} alt="Selected" className="w-full h-full object-cover" />
        ) : (
          <div className="text-blue-500">
            {getFileIcon(file.mimeType)}
          </div>
        )}
        <button onClick={() => setSelectedFile(null)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <X size={size === 'large' ? 14 : 10} className="text-white" />
        </button>
      </div>
    );
  };

  const handleElementClick = (data: EditElementData) => {
    if (isRealtimeEditMode) {
      setActiveEditElement(data);
    }
  };

  const handleSaveElementChanges = () => {
    if (!activeEditElement) return;

    const el = activeEditElement.elementRef;
    
    // Check if HTML was changed, if so replace entirely
    if (el.outerHTML !== activeEditElement.outerHTML) {
      el.outerHTML = activeEditElement.outerHTML;
    } else {
      // Update basic properties
      if (activeEditElement.tagName !== 'IMG') {
        el.textContent = activeEditElement.textContent;
      }
      
      el.style.fontSize = activeEditElement.fontSize;
      el.style.fontFamily = activeEditElement.fontFamily;

      if (activeEditElement.tagName === 'A' && activeEditElement.href) {
        (el as HTMLAnchorElement).href = activeEditElement.href;
      }
      
      if (activeEditElement.tagName === 'IMG' && activeEditElement.src) {
        (el as HTMLImageElement).src = activeEditElement.src;
      }
    }

    // Capture updated HTML from the iframe's context and update state
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      const doc = iframe.contentDocument;

      // Update Styles if edited
      const styleTags = Array.from(doc.querySelectorAll('style')).filter(s => s.id !== 'studio-edit-mode-styles');
      if (styleTags.length > 0) {
        styleTags[0].textContent = activeEditElement.css;
      }

      // Update Scripts if edited
      const scriptTags = Array.from(doc.querySelectorAll('script'));
      if (scriptTags.length > 0) {
        scriptTags[0].textContent = activeEditElement.js;
      }

      const editStyle = doc.getElementById('studio-edit-mode-styles');
      if (editStyle) editStyle.remove();
      
      const taggedElements = doc.querySelectorAll('[data-studio-edit-active]');
      taggedElements.forEach(elem => elem.removeAttribute('data-studio-edit-active'));

      const updatedHTML = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      setCode(updatedHTML);
      setEditableCode(updatedHTML);
      if (activeProjectId) {
        setHistory(prev => {
          const next = prev.map(p => p.id === activeProjectId ? { ...p, code: updatedHTML } : p);
          try {
            localStorage.setItem('ai_studio_history_v2', JSON.stringify(next));
          } catch (e) {
            console.warn("Failed to save history in handleSaveElementChanges", e);
          }
          return next;
        });
      }
    }

    setActiveEditElement(null);
  };

  const filteredHistory = history.filter(project => project.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const rootProjects = filteredHistory.filter(p => !p.parentId);
  const activeProject = history.find(h => h.id === activeProjectId);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,audio/*,video/*,text/plain,application/pdf,application/json" />
      <input type="file" ref={refineFileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,audio/*,video/*,text/plain,application/pdf,application/json" />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Gemini API Key Required Overlay Modal */}
      {showApiKeyPromptModal && (
        <div className="fixed inset-0 bg-gray-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" id="api-key-required-modal">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-blue-50/50 flex flex-col">
            <div className="p-8 bg-gradient-to-b from-blue-50/80 to-white border-b border-gray-100 flex flex-col items-center text-center">
              <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/30 mb-4 animate-in duration-500 zoom-in-50">
                <Key size={32} />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 tracking-tight leading-tight">Gemini API Key Diperlukan</h3>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                Platform ini dihoskan sebagai aplikasi web statik. Sila masukkan **Gemini API Key** anda sendiri pada permulaan untuk mula menjana aplikasi dengan lancar.
              </p>
              <p className="text-[9px] text-gray-400 mt-1 font-medium">
                Your key is stored 100% locally in your browser's LocalStorage and is never shared.
              </p>
            </div>
            
            <div className="p-8 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                    Sila Masukkan Gemini API Key
                  </label>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
                  >
                    Dapatkan Kunci di Google AI Studio <ArrowRight size={10} />
                  </a>
                </div>
                
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Enter AI Studio GEMINI_API_KEY..."
                    className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-xs font-mono font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-gray-400"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all"
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {customApiKey.trim() ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-150">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-[10px] text-emerald-800 font-bold">Kunci sedia untuk disimpan di pelayar web anda.</p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2.5">
                  <ZapOff size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-800/90 font-medium leading-relaxed">
                    Menjana binaan memerlukan kunci API yang beroperasi guna model Google Gemini.
                  </p>
                </div>
              )}
            </div>

            <div className="px-8 pb-8 pt-1">
              <button 
                type="button"
                onClick={() => {
                  if (customApiKey.trim()) {
                    try {
                      localStorage.setItem('ai_studio_api_key', customApiKey.trim());
                    } catch (e) {
                      console.warn("Failed to write API key to localStorage", e);
                    }
                    setShowApiKeyPromptModal(false);
                  }
                }}
                disabled={!customApiKey.trim()}
                className="w-full py-4 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-extrabold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Simpan & Teruskan <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Realtime Edit Popup Modal */}
      {activeEditElement && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-amber-100">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-amber-200">
                  <Pencil size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">Edit Element</h3>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{activeEditElement.tagName} Module</p>
                </div>
              </div>
              <button onClick={() => setActiveEditElement(null)} className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {activeEditElement.tagName !== 'IMG' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <Type size={12} className="text-blue-500" /> Text Content
                  </label>
                  <textarea 
                    value={activeEditElement.textContent}
                    onChange={(e) => setActiveEditElement({...activeEditElement, textContent: e.target.value})}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all resize-none min-h-[80px]"
                  />
                </div>
              )}

              {activeEditElement.tagName === 'IMG' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <ImageIcon size={12} className="text-blue-500" /> Image Source URL
                  </label>
                  <input 
                    type="text" 
                    value={activeEditElement.src || ''}
                    onChange={(e) => setActiveEditElement({...activeEditElement, src: e.target.value})}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              )}

              {activeEditElement.tagName === 'A' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <LinkIcon size={12} className="text-blue-500" /> Link URL (href)
                  </label>
                  <input 
                    type="text" 
                    value={activeEditElement.href || ''}
                    onChange={(e) => setActiveEditElement({...activeEditElement, href: e.target.value})}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <Maximize2 size={12} className="text-blue-500" /> Font Size
                  </label>
                  <input 
                    type="text" 
                    value={activeEditElement.fontSize}
                    onChange={(e) => setActiveEditElement({...activeEditElement, fontSize: e.target.value})}
                    placeholder="e.g. 16px or 1.5rem"
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <Type size={12} className="text-blue-500" /> Font Type
                  </label>
                  <input 
                    type="text" 
                    value={activeEditElement.fontFamily}
                    onChange={(e) => setActiveEditElement({...activeEditElement, fontFamily: e.target.value})}
                    placeholder="e.g. Arial, sans-serif"
                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <Code size={12} className="text-blue-500" /> HTML Section
                  </label>
                  <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800 shadow-inner">
                    <textarea 
                      value={activeEditElement.outerHTML}
                      onChange={(e) => setActiveEditElement({...activeEditElement, outerHTML: e.target.value})}
                      className="w-full h-32 bg-transparent text-blue-300 font-mono text-[10px] leading-relaxed resize-none focus:outline-none custom-scrollbar"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <FileCode size={12} className="text-yellow-500" /> JS Logic
                  </label>
                  <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800 shadow-inner">
                    <textarea 
                      value={activeEditElement.js}
                      onChange={(e) => setActiveEditElement({...activeEditElement, js: e.target.value})}
                      className="w-full h-32 bg-transparent text-yellow-200 font-mono text-[10px] leading-relaxed resize-none focus:outline-none custom-scrollbar"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    <Layout size={12} className="text-purple-500" /> CSS Styles
                  </label>
                  <div className="bg-[#0d1117] rounded-xl p-3 border border-gray-800 shadow-inner">
                    <textarea 
                      value={activeEditElement.css}
                      onChange={(e) => setActiveEditElement({...activeEditElement, css: e.target.value})}
                      className="w-full h-32 bg-transparent text-purple-300 font-mono text-[10px] leading-relaxed resize-none focus:outline-none custom-scrollbar"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setActiveEditElement(null)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all active:scale-95">Cancel</button>
              <button onClick={handleSaveElementChanges} className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg active:scale-95">Apply Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Quota Alert Modal */}
      {quotaExhausted && (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-md rounded-3xl shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-300 border border-orange-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <BellRing className="text-orange-500 w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Quota Exhausted</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed font-medium">The Google Gemini Engine has reached its limit for your current plan. Please wait a few minutes before trying again or check your API configuration.</p>
              <button onClick={() => setQuotaExhausted(false)} className="w-full py-4 px-6 bg-gray-900 hover:bg-black text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-xl shadow-gray-200">Understood</button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Confirmation Modal */}
      {overwriteCandidate && (
        <div className="fixed inset-0 bg-black/60 z-[115] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-200 border border-blue-50">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="text-blue-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Project Already Exists</h3>
              <p className="text-sm text-gray-500 mb-6 text-center leading-relaxed">A project named <span className="text-gray-900 font-bold">"{overwriteCandidate.name}"</span> is already saved in your history. Do you want to overwrite it with your current changes?</p>
              <div className="w-full bg-gray-50 rounded-2xl p-4 mb-8 space-y-3">
                <div className="flex items-start gap-3">
                  <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Modified</p>
                    <p className="text-xs font-semibold text-gray-600">{new Date(overwriteCandidate.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saved Prompt</p>
                    <p className="text-xs font-semibold text-gray-600 line-clamp-2">{overwriteCandidate.prompt}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setOverwriteCandidate(null)} className="flex-1 py-4 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-all active:scale-95">Cancel</button>
                <button onClick={handleConfirmOverwrite} className="flex-1 py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-xl shadow-blue-200">Overwrite</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-sm rounded-3xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Project?</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">Are you sure you want to delete this project? This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => { setIsDeleteModalOpen(false); setProjectToDeleteId(null); }} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-all active:scale-95">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-red-200">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                  <Settings size={20} className="text-gray-600" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Studio Settings</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full shadow-sm hover:shadow-md">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={16} className="text-blue-600" />
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400">Intelligence Engine</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'Ultra-fast, latest generation flash model.', icon: <Zap size={16} className="text-yellow-500" /> },
                    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', desc: 'Ultra-fast, latest generation lite model.', icon: <Zap size={16} className="text-blue-500" /> },
                    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'Fast stable performance.', icon: <Zap size={16} className="text-orange-500" /> },
                    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', desc: 'Advanced reasoning, latest pro model.', icon: <Sparkles size={16} className="text-purple-500" /> }
                  ].map(m => (
                    <div key={m.id} onClick={() => setSelectedModel(m.id)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedModel === m.id ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-600/10' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedModel === m.id ? 'bg-white shadow-sm' : 'bg-gray-50'}`}>{m.icon}</div>
                          <div>
                            <p className={`text-sm font-bold ${selectedModel === m.id ? 'text-blue-700' : 'text-gray-700'}`}>{m.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{m.desc}</p>
                          </div>
                        </div>
                        {selectedModel === m.id && <div className="bg-blue-600 rounded-full p-1 shadow-sm"><Check size={10} className="text-white" /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Keyboard size={16} className="text-blue-600" />
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400">Behavior</h3>
                </div>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-2xl border-2 border-gray-100 bg-white cursor-pointer hover:border-gray-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-50 rounded-lg"><Keyboard size={16} className="text-gray-600" /></div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">Submit Shortcut</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Action key to generate builds</p>
                      </div>
                    </div>
                    <select 
                      value={submitKeyShortcut} 
                      onChange={(e) => setSubmitKeyShortcut(e.target.value as 'ctrl-enter' | 'enter')}
                      className="bg-transparent text-sm font-bold text-blue-600 outline-none cursor-pointer"
                    >
                      <option value="ctrl-enter">Ctrl + Enter</option>
                      <option value="enter">Enter Only</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border-2 border-gray-100 bg-white cursor-pointer hover:border-gray-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-50 rounded-lg"><Save size={16} className="text-gray-600" /></div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">Autosave</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Save builds to history every 10s</p>
                      </div>
                    </div>
                    <div 
                      onClick={() => setIsAutosaveEnabled(!isAutosaveEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isAutosaveEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutosaveEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </label>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Key size={16} className="text-blue-600" />
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400">API Credentials</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border-2 border-gray-100 bg-white flex flex-col gap-2 transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-700">Gemini API Key</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Use your personal Gemini API Key instead of the default shared quota</p>
                      </div>
                    </div>
                    <div className="relative mt-2">
                      <input 
                        type={showApiKey ? "text" : "password"}
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        placeholder="Enter your GEMINI_API_KEY..."
                        className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {customApiKey && (
                      <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1 animate-in slide-in-from-top-1 duration-150">
                        <Check size={12} /> Custom API Key loaded successfully.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                <ZapOff size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-gray-400 leading-relaxed italic">Note: Pro models offer higher reasoning capabilities and larger thinking budgets but may have tighter rate limits.</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setIsSettingsOpen(false)} className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold hover:bg-black transition-all active:scale-95 shadow-lg">Done</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`fixed md:static inset-y-0 left-0 w-72 md:w-64 border-r border-gray-200 flex flex-col bg-white shrink-0 z-50 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm"><Sparkles className="text-white w-4 h-4" /></div>
            <span className="font-bold text-sm tracking-tight uppercase text-gray-600">APP GEN STUDIO</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setProjectTitle(''); setPrompt(''); setCode(''); setEditableCode(''); setViewMode('build'); setActiveProjectId(null); setIsMobileMenuOpen(false); }} className="flex items-center flex-col justify-center gap-1.5 bg-gray-900 hover:bg-black text-white p-3 rounded-xl transition-all text-[10px] font-bold shadow-md uppercase tracking-wider"><Plus size={16} /> New App</button>
            <button onClick={handleCreateBlankProject} className="flex items-center flex-col justify-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 p-3 rounded-xl transition-all hover:bg-blue-100 text-[10px] font-bold shadow-sm uppercase tracking-wider"><FileCode size={16} /> Blank</button>
          </div>
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input type="text" placeholder="Search history..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400" />
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar" ref={sidebarScrollRef}>
            <div className="px-3 mb-3 flex items-center justify-between"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">History</span></div>
            {filteredHistory.length === 0 ? <div className="px-3 py-4 text-xs text-gray-400 italic">{searchTerm ? 'No matches found' : 'No previous builds'}</div> : (
              <div className="space-y-4 pb-4">
                {rootProjects.map((project) => {
                  const actualChildren = history.filter(p => p.parentId === project.id && (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.prompt.toLowerCase().includes(searchTerm.toLowerCase()))).sort((a, b) => a.timestamp - b.timestamp);
                  const children = [project, ...actualChildren];
                  const isEditing = editingProjectId === project.id;
                  return (
                    <div key={project.id} className="space-y-1">
                      <div onClick={() => !isEditing && loadFromHistory(project)} className={`group relative px-3 py-2.5 rounded-lg cursor-pointer flex flex-col transition-all border border-transparent ${activeProjectId === project.id ? 'bg-blue-50 border-blue-100' : 'hover:bg-gray-100'}`}>
                        {isEditing ? <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><input autoFocus type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => handleRename(project.id, renameValue)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(project.id, renameValue); if (e.key === 'Escape') setEditingProjectId(null); }} className="w-full bg-white border border-blue-300 rounded px-1.5 py-0.5 text-xs font-bold text-gray-700 outline-none" /></div> : (
                          <div className="flex items-center justify-between w-full group/title">
                            <span className={`text-xs font-bold truncate pr-8 ${activeProjectId === project.id ? 'text-blue-700' : 'text-gray-700'}`}>{project.name}</span>
                            <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); setRenameValue(project.name); }} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"><Pencil size={11} /></button>
                              <button onClick={(e) => openDeleteConfirmation(project.id, e)} className="p-1.5 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        )}
                        <span className="text-[9px] text-gray-400 mt-0.5">{new Date(project.timestamp).toLocaleDateString()} {new Date(project.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {children.length > 0 && <div className="ml-4 pl-2 border-l border-gray-100 space-y-1 mt-1">
                        {children.map(child => {
                          const isOriginal = child.id === project.id;
                          return (
                            <div key={child.id} onClick={() => loadFromHistory(child)} className={`group relative px-2 py-1.5 rounded-md cursor-pointer flex items-center gap-2 transition-all border border-transparent ${activeProjectId === child.id ? 'bg-blue-50 text-blue-700 border-blue-100' : 'text-gray-500 hover:bg-gray-100'}`}>
                              <CornerDownRight size={10} className="text-gray-300 shrink-0" />
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] font-medium truncate pr-10" title={isOriginal ? `Binaan Asal: ${child.prompt || child.name}` : child.prompt || child.name.replace('Refined: ', '')}>
                                  {isOriginal ? `Binaan Asal: ${child.prompt || child.name}` : (child.prompt || child.name.replace('Refined: ', ''))}
                                </span>
                                {!isOriginal && (
                                  <div className="absolute top-1/2 -translate-y-1/2 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={(e) => openDeleteConfirmation(child.id, e)} className="p-1 text-gray-300 hover:text-red-500 transition-all">
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 bg-gray-50/50 mt-auto px-4 py-3">
          <button onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center justify-between w-full text-gray-500 hover:text-gray-900 text-xs font-medium transition-all group pt-1">
            <div className="flex items-center gap-3"><Settings size={14} /><span>Studio Settings</span></div>
            {(() => {
              const info = getModelBadgeInfo(selectedModel);
              return <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${info.className}`}><span>{info.version}</span><span className="opacity-50">•</span><span>{info.label}</span></div>;
            })()}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        <header className="h-14 md:h-16 border-b border-gray-200 flex items-center justify-between px-3 md:px-6 bg-white z-20 shrink-0">
          <div className="flex items-center gap-2 md:gap-6">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Menu size={20} /></button>
            <nav className="flex items-center gap-0.5 md:gap-1 bg-gray-100/80 p-1 rounded-xl">
              {[{ id: 'build', label: 'Build' }, { id: 'preview', label: 'Preview' }, { id: 'code', label: 'Source' }].map((tab) => (
                <button key={tab.id} onClick={() => (code || tab.id === 'build') && setViewMode(tab.id as ViewMode)} disabled={!code && tab.id !== 'build'} className={`px-2.5 md:px-4 py-1 rounded-lg text-[11px] md:text-xs font-bold transition-all ${viewMode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 disabled:opacity-30'}`}>{tab.label}</button>
              ))}
            </nav>
            {viewMode === 'preview' && (
              <div className="hidden md:flex items-center gap-1 border-l border-gray-200 pl-4 ml-2">
                {[{ device: PreviewDevice.DESKTOP, icon: <Monitor size={14} />, label: 'Desktop' }, { device: PreviewDevice.MOBILE, icon: <Smartphone size={14} />, label: 'Mobile' }].map((item) => (
                  <button key={item.device} onClick={() => { if (device === item.device) setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait'); else { setDevice(item.device); setOrientation('portrait'); } }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${device === item.device ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>{item.icon}<span className={`${device === item.device ? 'block' : 'hidden lg:block'}`}>{item.label}</span></button>
                ))}
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                {/* Fix: removed invalid handleReloadPreview attribute */}
                <button onClick={handleReloadPreview} className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors" title="Reload Preview"><RefreshCw size={16} /></button>
                <button onClick={() => setIsRealtimeEditMode(!isRealtimeEditMode)} className={`p-1.5 rounded-lg transition-all ${isRealtimeEditMode ? 'bg-amber-100 text-amber-600 shadow-sm' : 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'}`} title="Toggle Realtime Edit"><Pencil size={16} /></button>
                <button onClick={toggleFullScreen} className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors" title="Full Screen Preview"><Maximize2 size={16} /></button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="flex items-center gap-3">
              {lastAutosave && isAutosaveEnabled && (
                <div className="hidden lg:flex items-center gap-1.5 text-gray-400">
                  <Clock size={12} />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Saved {new Date(lastAutosave).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              )}
              {code && (
                <>
                  <button onClick={handleSaveProject} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${saveSuccess ? 'bg-green-50 text-green-600 border border-green-200' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent'}`} title="Export Project">{saveSuccess ? <Check size={18} /> : <Download size={18} />}<span className="hidden lg:block text-[10px] font-bold uppercase tracking-wider">{saveSuccess ? 'Exported' : 'Export'}</span></button>
                  <button onClick={toggleRefineSidebar} className={`p-2 rounded-lg transition-all ${showRefineSidebar ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-100'}`} title="Refine Build"><MessageSquare size={18} /></button>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden relative bg-gray-50">
          <div className="flex-1 relative overflow-hidden flex flex-col">
            {viewMode === 'build' && (
              <div className="h-full overflow-y-auto custom-scrollbar bg-white flex-1">
                <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8 max-w-4xl mx-auto w-full">
                  <div className="text-center mb-6 md:mb-10">
                    <div className="inline-flex p-4 rounded-3xl bg-blue-50 text-blue-600 mb-4 md:mb-6 shadow-sm border border-blue-100"><Sparkles size={32} /></div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 mb-2 md:mb-4 tracking-tight px-4">Architect Your Idea</h2>
                    <p className="text-gray-500 text-sm md:text-lg max-w-md md:max-w-xl mx-auto leading-relaxed px-4">Describe your dream application or start with a blank canvas.</p>
                  </div>
                  <div className="w-full space-y-4 md:space-y-6 max-w-2xl px-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1"><Type size={12} className="text-blue-600" />Project Title (Required)</label>
                      <input type="text" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="e.g. My Awesome Dashboard" className="w-full px-4 md:px-6 py-4 bg-gray-50/50 border-2 border-gray-100 focus:border-blue-500 focus:bg-white rounded-2xl text-gray-800 placeholder:text-gray-400 focus:outline-none transition-all text-base md:text-lg shadow-inner font-semibold" />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1"><MessageSquare size={12} className="text-blue-600" />App Description</label>
                      <div className="relative flex flex-col bg-gray-50/50 border-2 border-gray-100 focus-within:border-blue-500 focus-within:bg-white rounded-2xl md:rounded-3xl transition-all shadow-inner overflow-hidden min-h-[160px]">
                        <textarea 
                          value={prompt} 
                          onChange={(e) => setPrompt(e.target.value)} 
                          onKeyDown={(e) => { 
                            const shouldSubmit = submitKeyShortcut === 'ctrl-enter' 
                              ? (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                              : (e.key === 'Enter' && !e.shiftKey);
                              
                            if (shouldSubmit) { 
                              e.preventDefault(); 
                              handleGenerate(false); 
                            } 
                          }}
                          placeholder="Describe the application you want to build in detail..." 
                          className="w-full flex-1 p-4 md:p-6 bg-transparent resize-none text-gray-800 placeholder:text-gray-400 focus:outline-none text-base md:text-lg custom-scrollbar min-h-[100px]" 
                        />
                        
                        {/* Selected File & Action bar at the bottom */}
                        <div className="flex items-center justify-between px-4 pb-4 md:px-6 md:pb-6 bg-transparent z-10 shrink-0 border-t border-gray-100/50 pt-3">
                          <div className="flex-1 min-w-0 pr-4">
                            {selectedFile && !isGenerating ? (
                              <div className="flex items-center gap-3">
                                {renderFilePreview(selectedFile, 'large')}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold text-gray-500 truncate max-w-[180px] md:max-w-xs">{selectedFile.name}</span>
                                  <button onClick={() => setSelectedFile(null)} className="text-[10px] text-red-500 hover:text-red-600 font-bold hover:underline transition-all text-left">Remove file</button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          
                          {/* Upload Button */}
                          {!isGenerating && (
                            <button 
                              onClick={triggerUpload}
                              className={`p-2 rounded-full transition-all shadow-sm shrink-0 ${selectedFile ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-gray-100'}`}
                              title="Add File"
                            >
                              <Plus size={18} />
                            </button>
                          )}
                        </div>

                        {isGenerating && (
                          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-2xl md:rounded-3xl z-10 backdrop-blur-sm">
                            <Loader2 size={32} className="text-blue-600 animate-spin mb-3" />
                            <p className="text-blue-600 font-bold text-[10px] tracking-[0.2em] uppercase animate-pulse px-4 text-center mb-6">Architecting Solution...</p>
                            <button onClick={handleStopGeneration} className="px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm border border-red-100"><Square size={12} fill="currentColor" />Stop Building</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {!isGenerating && (
                      <div className="flex gap-4">
                        <button disabled={isGenerating || !prompt.trim() || !projectTitle.trim()} onClick={() => handleGenerate(false)} className="flex-1 py-4 md:py-5 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]">Generate Build <ArrowRight size={18} /></button>
                      </div>
                    )}
                  </div>
                  {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-[11px] font-semibold border border-red-100 flex items-center gap-2 mx-2 text-center flex-col md:flex-row"><div className="flex items-center gap-2 mb-2 md:mb-0"><X size={12} className="shrink-0" /><span className="font-bold">Error:</span></div><span className="flex-1">{error}</span></div>}
                </div>
              </div>
            )}

            {viewMode === 'preview' && (
              <div className="h-full w-full flex flex-col flex-1 relative">
                <div className="md:hidden flex items-center justify-between p-2 bg-white border-b border-gray-200 shrink-0">
                  <div className="flex items-center gap-1">{[{ d: PreviewDevice.MOBILE, i: <Smartphone size={16} />, l: 'Mobile' }, { d: PreviewDevice.DESKTOP, i: <Monitor size={16} />, l: 'Desktop' }].map(btn => (
                    <button key={btn.d} onClick={() => setDevice(btn.d)} className={`flex items-center gap-2 p-2 rounded-lg transition-all ${device === btn.d ? 'bg-blue-600 text-white shadow-sm px-3' : 'text-gray-400 hover:bg-gray-100'}`}>{btn.i}{device === btn.d && <span className="text-[10px] font-bold uppercase">{btn.l}</span>}</button>
                  ))}</div>
                  <div className="flex items-center gap-1">
                    {/* Fix: removed invalid handleReloadPreview attribute */}
                    <button onClick={handleReloadPreview} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="Reload Preview"><RefreshCw size={16} /></button>
                    <button onClick={() => setIsRealtimeEditMode(!isRealtimeEditMode)} className={`p-2 rounded-lg transition-all ${isRealtimeEditMode ? 'bg-amber-100 text-amber-600 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`} title="Toggle Realtime Edit"><Pencil size={16} /></button>
                    <button onClick={toggleFullScreen} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="Full Screen Preview"><Maximize2 size={16} /></button>
                    <button onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')} className="px-2 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg text-[9px] font-bold border border-gray-200 uppercase">{orientation}</button>
                  </div>
                </div>
                {isGenerating && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[30] bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-blue-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300"><Loader2 size={16} className="text-blue-600 animate-spin" /><span className="text-xs font-bold text-blue-900 tracking-tight">Surgical Update...</span><button onClick={handleStopGeneration} className="ml-2 p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Cancel"><X size={14} /></button></div>}
                <div ref={previewContainerRef} className="flex-1 relative overflow-hidden bg-gray-100/50">
                  <PreviewFrame 
                    code={code} 
                    device={device} 
                    orientation={orientation} 
                    key={previewKey} 
                    isRealtimeEditMode={isRealtimeEditMode}
                    onElementClick={handleElementClick}
                  />
                </div>
              </div>
            )}

            {viewMode === 'code' && (
              <div className="h-full w-full bg-[#0d1117] flex flex-col flex-1">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0d1117] sticky top-0 z-10 shrink-0">
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Source Editor</span>
                  <div className="flex items-center gap-4">
                    <button onClick={applyManualChanges} className={`text-[10px] font-bold flex items-center gap-1.5 transition-all duration-300 ${applySuccess ? 'text-green-400 scale-105' : 'text-blue-400 hover:text-blue-300'}`}>
                      {applySuccess ? <Check size={12} /> : <Save size={12} />}
                      {applySuccess ? 'Applied Successfully' : 'Apply Changes'}
                    </button>
                    <button onClick={handleSelectAllCode} className="text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
                      <Square size={12} />
                      Select All
                    </button>
                    <button onClick={copyToClipboard} className="text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={handlePasteCode} className="text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
                      <Clipboard size={12} />
                      Paste
                    </button>
                    <button onClick={handleClearCode} className="text-[10px] font-bold text-red-500/80 hover:text-red-400 flex items-center gap-1.5 transition-colors">
                      <Trash2 size={12} />
                      Clear
                    </button>
                  </div>
                </div>
                <div className="flex-1 relative bg-[#0d1117]">
                  <textarea 
                    ref={codeTextareaRef}
                    value={editableCode} 
                    onChange={(e) => setEditableCode(e.target.value)} 
                    className="w-full h-full p-4 md:p-6 bg-[#0d1117] text-gray-300 font-mono text-xs md:text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar border-none selection:bg-blue-500/30" 
                    spellCheck={false} 
                  />
                </div>
              </div>
            )}
          </div>

          {showRefineSidebar && code && (
            <>
              <div className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-[2px]" onClick={() => setShowRefineSidebar(false)} />
              <div className="fixed right-0 top-0 bottom-0 w-full md:w-80 h-full bg-white/80 md:backdrop-blur-xl border-l border-gray-200 flex flex-col shadow-2xl z-40 animate-in slide-in-from-right duration-300 overflow-hidden">
                <div className="p-4 border-b border-white/20 flex items-center justify-between bg-white/40"><div className="flex items-center gap-2"><MessageSquare size={16} className="text-blue-600" /><span className="text-xs font-bold uppercase tracking-wider text-gray-600">Refine Build</span></div><button onClick={() => setShowRefineSidebar(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full transition-all"><X size={20} /></button></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-200/50"><p className="text-[11px] text-blue-800 leading-relaxed font-semibold">AI is in <strong>Surgical Mode</strong>. Only the requested changes will be applied. Unrelated parts stay untouched.</p></div>
                  {activeProject && (
                    <div className="space-y-3">
                      <div className="bg-white/50 backdrop-blur-sm p-3.5 rounded-xl border border-white/50 shadow-sm flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
                          Current Build
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${activeProject.parentId ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {activeProject.parentId ? "Perubahan Refine" : "Binaan Asal"}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-700 font-medium leading-relaxed bg-gray-50/30 p-2.5 rounded-lg border border-gray-100/50 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                          {activeProject.prompt || activeProject.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-white/20 bg-white/40 pb-8 md:pb-6">
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <textarea 
                        value={refinePrompt} 
                        onChange={(e) => setRefinePrompt(e.target.value)} 
                        placeholder="e.g. Change only the button color to emerald..." 
                        onKeyDown={(e) => { 
                          const shouldSubmit = submitKeyShortcut === 'ctrl-enter' 
                            ? (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                            : (e.key === 'Enter' && !e.shiftKey);
                            
                          if (shouldSubmit) { 
                            e.preventDefault(); 
                            handleGenerate(true); 
                          } 
                        }} 
                        className="w-full h-24 p-4 pr-12 bg-white/80 border border-gray-200/50 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl resize-none text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none transition-all shadow-lg custom-scrollbar disabled:opacity-50" 
                      />
                      
                      {/* File Preview in Refine */}
                      {selectedFile && !isGenerating && (
                        <div className="absolute top-2 right-2 group">
                          {renderFilePreview(selectedFile, 'small')}
                        </div>
                      )}
                      
                      {/* Refine Upload Button */}
                      {!isGenerating && (
                        <button 
                          onClick={triggerRefineUpload}
                          className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-all shadow-sm ${selectedFile ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                          title="Add File"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex flex-col"><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Surgical Edit Mode</span></div></div>
                      <div className="flex items-center gap-2">
                        {isGenerating ? <button onClick={handleStopGeneration} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl transition-all hover:bg-red-100 active:scale-95 text-xs font-bold border border-red-100"><Square size={12} fill="currentColor" />Stop</button> : <button onClick={() => handleGenerate(true)} disabled={isGenerating || !refinePrompt.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl shadow-xl transition-all disabled:bg-gray-200 hover:bg-blue-700 active:scale-95 text-xs font-bold">Apply<ArrowRight size={14} /></button>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;