import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Camera, 
  Sparkles, 
  ChevronRight, 
  Download,
  RefreshCw,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Zap,
  ArrowLeft,
  Sun,
  Maximize,
  History,
  MessageSquare,
  Trash2,
  ExternalLink,
  ChevronLeft,
  Copy,
  Check,
  Maximize2,
  Split,
  User,
  DownloadCloud,
  Layout,
  Smartphone,
  Facebook,
  ShoppingBag,
  Target,
  BarChart3,
  Calendar,
  MousePointer2,
  Brush,
  Grid
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, ProductType, Style, TargetPlatform, LightingMood, AspectRatio, ResultItem } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const STYLE_PREVIEWS: Record<Style, string> = {
  'Luxury': 'https://picsum.photos/seed/luxury/100/100',
  'Minimal': 'https://picsum.photos/seed/minimal/100/100',
  'Instagram': 'https://picsum.photos/seed/instagram/100/100',
  'E-commerce': 'https://picsum.photos/seed/ecommerce/100/100',
  'Cinematic': 'https://picsum.photos/seed/cinematic/100/100',
};

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center">
          <div className="glass-panel p-12 max-w-md space-y-6">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-display font-bold">Something went wrong</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              SnapStudio AI encountered an unexpected error. This might be due to a connection issue or a temporary AI glitch.
            </p>
            <div className="bg-black/40 p-4 rounded-xl text-left overflow-x-auto">
              <code className="text-[10px] text-red-400 font-mono">
                {this.state.error?.message}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SnapStudioApp />
    </ErrorBoundary>
  );
}

function SnapStudioApp() {
  const [state, setState] = useState<AppState>({
    step: 'home',
    productImage: null,
    results: [],
    currentResultIndex: 0,
    history: [],
    showGrid: false,
    showHeatmap: false,
    error: null,
    lightPosition: { x: 50, y: 50 },
    aspectRatio: '1:1',
    lighting: 'Studio Soft',
    style: 'Luxury',
    isCampaignMode: false,
    mockupMode: 'none',
    userImage: null,
    addHumanTouch: false,
    activeAccent: 'none',
    isTryOnMode: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage with 1-hour expiration check
  useEffect(() => {
    const saved = localStorage.getItem('snapstudio_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Filter out items older than 1 hour
        const validHistory = parsed.filter((item: any) => (now - item.timestamp) < oneHour);
        
        setState(prev => ({ ...prev, history: validHistory.slice(0, 4) }));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage with quota handling
  useEffect(() => {
    const saveHistory = (data: any[]) => {
      try {
        localStorage.setItem('snapstudio_history', JSON.stringify(data));
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          // If quota exceeded, try saving with one less item recursively
          if (data.length > 1) {
            console.warn("LocalStorage quota exceeded, trimming history...");
            saveHistory(data.slice(0, -1));
          } else {
            // If even one item is too big, clear it
            console.error("Single history item exceeds localStorage quota.");
            localStorage.removeItem('snapstudio_history');
          }
        }
      }
    };
    
    if (state.history.length > 0) {
      saveHistory(state.history);
    }
  }, [state.history]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setState(prev => ({ 
        ...prev, 
        productImage: reader.result as string,
        step: 'input' 
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const generateAnalysis = async (resultId: string, image: string, retries = 3): Promise<void> => {
    setState(prev => ({
      ...prev,
      results: prev.results.map(res => res.id === resultId ? { ...res, isAnalyzing: true } : res)
    }));
    try {
      const analysisPrompt = `Analyze this photoshoot image for a ${state.productType || 'Product'} targeting ${state.targetPlatform || 'Instagram'}. 
        Style: ${state.style}, Lighting: ${state.lighting}.
        
        Provide:
        1. Instagram caption with hashtags.
        2. Punchy ad copy line.
        3. Conversion Score (0-100) based on visual appeal and platform best practices.
        4. A 1-sentence marketing analysis of why it will convert.
        5. A "Synthetic Focus Group" feedback from 3 distinct personas:
           - "The Skeptical Gen Z" (Values authenticity, raw vibes, sustainability)
           - "The Luxury Collector" (Values status, premium details, exclusivity)
           - "The Budget-Conscious Parent" (Values durability, practicality, value)
        6. "AI Eye-Tracking Heatmap Data":
           - Provide 5-8 "Hot Zones" (x, y coordinates from 0-100 and intensity from 0.1-1.0) where a human eye would land first.
           
        Return as a JSON object with keys: instagram, adCopy, score, analysis, focusGroup, heatmapData.
        The focusGroup key should be an array of 3 objects with keys: name, avatar, feedback, sentiment (positive/neutral/negative).
        The heatmapData key should be an array of objects with keys: x, y, intensity.`;

      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { text: analysisPrompt },
          { inlineData: { data: image.split(',')[1], mimeType: 'image/png' } }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              instagram: { type: Type.STRING },
              adCopy: { type: Type.STRING },
              score: { type: Type.NUMBER },
              analysis: { type: Type.STRING },
              focusGroup: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    avatar: { type: Type.STRING },
                    feedback: { type: Type.STRING },
                    sentiment: { type: Type.STRING }
                  },
                  required: ["name", "avatar", "feedback", "sentiment"]
                }
              },
              heatmapData: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    intensity: { type: Type.NUMBER }
                  },
                  required: ["x", "y", "intensity"]
                }
              }
            },
            required: ["instagram", "adCopy", "score", "analysis", "focusGroup", "heatmapData"]
          }
        }
      });

      const analysis = JSON.parse(analysisResponse.text || '{}');
      
      setState(prev => ({
        ...prev,
        results: prev.results.map(res => res.id === resultId ? {
          ...res,
          caption: { instagram: analysis.instagram, adCopy: analysis.adCopy },
          score: analysis.score,
          analysis: analysis.analysis,
          focusGroup: analysis.focusGroup,
          heatmapData: analysis.heatmapData,
          isAnalyzing: false,
        } : res)
      }));
    } catch (error: any) {
      const isQuotaError = error?.status === 'RESOURCE_EXHAUSTED' || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('quota');

      if (isQuotaError && retries > 0) {
        const waitTime = (4 - retries) * 4000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return generateAnalysis(resultId, image, retries - 1);
      }
      console.error("Analysis failed:", error);
      setState(prev => ({
        ...prev,
        results: prev.results.map(res => res.id === resultId ? { ...res, isAnalyzing: false } : res)
      }));
    }
  };

  const generatePhotoshoot = async (isRefining = false) => {
    setState(prev => ({ ...prev, step: 'processing' }));

    try {
      const basePrompt = state.isTryOnMode ? `
        VIRTUAL TRY-ON MODE:
        Take the product from Image 1 and realistically place it on the person in Image 2.
        Maintain the person's pose, features, and body type while seamlessly integrating the product (clothing/accessory/item).
        The result must look like a professional photoshoot where the person is actually wearing or using the product.
        
        Style: ${state.style}
        Lighting Mood: ${state.lighting}
        ${isRefining ? `REFINE REQUEST: ${refineInput}` : ''}
        
        RULES:
        1. PRODUCT PRESERVATION: Keep the product's design and details intact.
        2. SEAMLESS INTEGRATION: Natural shadows, realistic fabric draping, and proper scaling.
        3. QUALITY: 4K ultra-realistic, no AI artifacts.
      ` : `
        You are a professional product photographer and creative director.
        Generate a hyper-realistic, high-end product photoshoot image based on the provided product image.
        
        Product Type: ${state.productType || 'Auto-detect'}
        Style: ${state.style}
        Lighting Mood: ${state.lighting}
        Light Source Position: ${state.lightPosition.x}% from left, ${state.lightPosition.y}% from top.
        Background Preference: ${state.backgroundPreference || 'Premium realistic setting matching category'}
        Target Platform: ${state.targetPlatform || 'Instagram'}
        ${isRefining ? `REFINE REQUEST: ${refineInput}` : ''}
        ${state.addHumanTouch ? 'HUMAN TOUCH: Include a realistic human hand holding or interacting with the product for scale and lifestyle context.' : ''}
        ${state.activeAccent !== 'none' ? `LIGHTING ACCENT: Add a ${state.activeAccent} effect to the product.` : ''}

        RULES:
        1. PRODUCT PRESERVATION: Keep the product EXACTLY the same. No shape, logo, or design changes.
        2. BACKGROUND: Replace with a premium, realistic setting. 
        3. LIGHTING: ${state.lighting} style. Cinematic, soft, realistic lighting with natural shadows and reflections.
        4. COMPOSITION: Rule of thirds, depth of field (background blur), focus sharp on product.
        5. QUALITY: 4K ultra-realistic, no AI artifacts.
      `;

      // Define variations or chapters
      const variationPrompts = state.isCampaignMode && !state.isTryOnMode ? [
        { chapter: 'Teaser', prompt: `${basePrompt} CHAPTER: TEASER. Moody, close-up, mysterious, high-contrast lighting, tight crop on a detail.` },
        { chapter: 'Hero', prompt: `${basePrompt} CHAPTER: HERO. Luxury studio setup, clear product view, centered, perfect lighting, professional catalog style.` },
        { chapter: 'Lifestyle', prompt: `${basePrompt} CHAPTER: LIFESTYLE. In-use setting, natural environment, warm lighting, lifestyle context matching the product category.` },
        { chapter: 'Sale', prompt: `${basePrompt} CHAPTER: SALE. Minimalist e-commerce style, clean white/grey background, sharp shadows, high clarity for product details.` }
      ] : [
        { chapter: undefined, prompt: `${basePrompt} Variation 1: Main composition.` },
        { chapter: undefined, prompt: `${basePrompt} Variation 2: Dynamic angle.` },
        { chapter: undefined, prompt: `${basePrompt} Variation 3: Close-up detail.` },
        { chapter: undefined, prompt: `${basePrompt} Variation 4: Creative artistic shot.` }
      ];

      // Sequential Image Generation with Retry and Backoff to avoid 429
      const imageUrls: string[] = [];
      
      const generateSingleImage = async (v: any, index: number, retries = 3): Promise<string> => {
        try {
          const parts: any[] = [
            { inlineData: { data: state.productImage!.split(',')[1], mimeType: 'image/png' } },
            { text: v.prompt }
          ];

          if (state.isTryOnMode && state.userImage) {
            parts.push({ inlineData: { data: state.userImage.split(',')[1], mimeType: 'image/png' } });
          }

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: state.aspectRatio as any
              }
            }
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
          throw new Error("No image in response");
        } catch (error: any) {
          const isQuotaError = error?.status === 'RESOURCE_EXHAUSTED' || 
                              error?.message?.includes('429') || 
                              error?.message?.includes('quota');
          
          if (isQuotaError && retries > 0) {
            const waitTime = (4 - retries) * 3000; // Exponential-ish backoff
            console.warn(`Quota hit for image ${index + 1}, retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
            return generateSingleImage(v, index, retries - 1);
          }
          throw error;
        }
      };

      for (let i = 0; i < variationPrompts.length; i++) {
        const url = await generateSingleImage(variationPrompts[i], i);
        imageUrls.push(url);
        // Small delay between successful calls to stay under RPM limits
        if (i < variationPrompts.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (imageUrls.length === 0) throw new Error("No images generated");

      const newResults: ResultItem[] = imageUrls.map((url, i) => {
        return {
          id: Math.random().toString(36).substr(2, 9),
          image: url,
          caption: {
            instagram: "",
            adCopy: ""
          },
          score: 0,
          analysis: "",
          focusGroup: [],
          heatmapData: [],
          chapter: variationPrompts[i].chapter as any,
          style: state.style!,
          lighting: state.lighting!,
          aspectRatio: state.aspectRatio!,
          timestamp: Date.now()
        };
      });

      setState(prev => ({
        ...prev,
        step: 'result',
        results: newResults,
        currentResultIndex: 0,
        history: [...newResults, ...prev.history].slice(0, 4), // Limited to 4 items
      }));
      setRefineInput('');

      // Auto-trigger analysis for the first variation
      generateAnalysis(newResults[0].id, newResults[0].image);

    } catch (error: any) {
      console.error("Generation failed:", error);
      const isQuotaError = error?.status === 'RESOURCE_EXHAUSTED' || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('quota');
      
      const errorMessage = isQuotaError 
        ? "AI Quota Exceeded. Please wait a minute before trying again. This happens when the AI is processing too many requests."
        : "Something went wrong during generation. Please try again.";

      setState(prev => ({ ...prev, step: 'input', error: errorMessage }));
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadAll = () => {
    state.results.forEach((res, index) => {
      const link = document.createElement('a');
      link.href = res.image;
      link.download = `snapstudio-variation-${index + 1}.png`;
      link.click();
    });
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `snapstudio-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 overflow-x-hidden relative">
      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-zinc-950 border-l border-white/10 z-50 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-display font-bold">History</h3>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <div className="space-y-4">
                {state.history.length === 0 && (
                  <p className="text-zinc-500 text-sm text-center py-10">No history yet.</p>
                )}
                {state.history.map((item) => (
                  <div 
                    key={item.id} 
                    className="group relative glass-panel p-2 cursor-pointer hover:border-white/20 transition-all"
                    onClick={() => {
                      setState(prev => ({ ...prev, step: 'result', results: [item], currentResultIndex: 0 }));
                      setShowHistory(false);
                    }}
                  >
                    <img src={item.image} alt="History" className="w-full aspect-square object-cover rounded-xl mb-2" />
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-zinc-500">{new Date(item.timestamp).toLocaleDateString()}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setState(prev => ({ ...prev, history: prev.history.filter(h => h.id !== item.id) }));
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state.step === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl text-center space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-sm font-medium mb-4"
              >
                <Sparkles className="w-4 h-4 text-yellow-500" />
                AI-Powered Product Photography
              </motion.div>
              <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tight premium-gradient">
                SnapStudio AI
              </h1>
              <p className="text-xl md:text-2xl text-zinc-400 max-w-lg mx-auto font-light leading-relaxed">
                Turn your product into a premium photoshoot in 1 click.
              </p>
            </div>

            <div className="pt-8">
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative group cursor-pointer max-w-md mx-auto p-12 rounded-[2.5rem] border-2 border-dashed transition-all duration-500
                  ${isDragging ? 'border-white bg-white/10 scale-105' : 'border-white/10 bg-white/5 hover:border-white/30'}
                `}
                onClick={handleUploadClick}
              >
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Drop your product here</p>
                    <p className="text-zinc-500 text-sm">or click to browse files</p>
                  </div>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            <div className="flex items-center justify-center gap-8 pt-12">
              <button 
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-medium"
              >
                <History className="w-4 h-4" />
                View History
              </button>
            </div>
          </motion.div>
        )}

        {state.step === 'input' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-6xl grid lg:grid-cols-12 gap-8 items-start"
          >
              <div className="lg:col-span-5 space-y-6">
                <button 
                  onClick={() => setState(prev => ({ ...prev, step: 'home' }))}
                  className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                
                <div className="space-y-4">
                  <div className="glass-panel p-6 aspect-square flex flex-col items-center justify-center overflow-hidden relative">
                    <span className="absolute top-4 left-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Product Image</span>
                    {state.productImage ? (
                      <img 
                        src={state.productImage} 
                        alt="Product" 
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <div className="text-zinc-700 flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8" />
                        <span className="text-xs">No image</span>
                      </div>
                    )}
                  </div>

                  <div className="glass-panel p-6 aspect-video flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setState(prev => ({ ...prev, userImage: reader.result as string, isTryOnMode: true }));
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}>
                    <span className="absolute top-4 left-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <User className="w-3 h-3" /> Virtual Try-On (Me)
                    </span>
                    {state.userImage ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={state.userImage} 
                          alt="User" 
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); setState(prev => ({ ...prev, userImage: null, isTryOnMode: false })); }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-zinc-700 flex flex-col items-center gap-2 group-hover:text-zinc-500 transition-colors">
                        <Upload className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Upload Your Photo</span>
                        <p className="text-[8px] text-zinc-600 text-center px-4">AI will place the product on you</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            <div className="lg:col-span-7 glass-panel p-8 space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-semibold">Customize Visuals</h2>
                <p className="text-zinc-500 text-sm">Fine-tune your photoshoot or let AI decide.</p>
              </div>

              {state.error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
                >
                  <Zap className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400 font-medium">{state.error}</p>
                    <button 
                      onClick={() => setState(prev => ({ ...prev, error: null }))}
                      className="text-[10px] uppercase font-bold text-red-500/60 hover:text-red-500 mt-1 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Product Type</label>
                    <div className="flex flex-wrap gap-2">
                      {['Fashion', 'Food', 'Tech', 'Beauty', 'Other'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setState(prev => ({ ...prev, productType: type as ProductType }))}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            state.productType === type 
                              ? 'bg-white text-black' 
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Visual Style</label>
                    <div className="grid grid-cols-5 gap-2">
                      {(Object.keys(STYLE_PREVIEWS) as Style[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => setState(prev => ({ ...prev, style: style }))}
                          className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                            state.style === style ? 'border-white' : 'border-transparent'
                          }`}
                        >
                          <img src={STYLE_PREVIEWS[style]} alt={style} className="w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                          <div className="absolute inset-0 flex items-end p-1 bg-gradient-to-t from-black/80 to-transparent">
                            <span className="text-[8px] font-bold uppercase tracking-tighter">{style}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <Sun className="w-3 h-3" /> Lighting Mood
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Golden Hour', 'Cyberpunk', 'Studio Soft', 'Natural Window', 'Moody Dark'].map((mood) => (
                        <button
                          key={mood}
                          onClick={() => setState(prev => ({ ...prev, lighting: mood as LightingMood }))}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            state.lighting === mood 
                              ? 'bg-white text-black' 
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          {mood}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <Maximize className="w-3 h-3" /> Aspect Ratio
                    </label>
                    <div className="flex gap-2">
                      {['1:1', '9:16', '16:9', '4:5'].map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setState(prev => ({ ...prev, aspectRatio: ratio as AspectRatio }))}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                            state.aspectRatio === ratio 
                              ? 'bg-white text-black border-white' 
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Background Preference</label>
                    <input 
                      type="text"
                      placeholder="e.g. Marble table with soft sunlight"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                      onChange={(e) => setState(prev => ({ ...prev, backgroundPreference: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Sun className="w-3 h-3" /> Virtual Gaffer (Relighting)</span>
                      <span className="text-[10px] font-bold text-zinc-600 uppercase">Interactive</span>
                    </label>
                    <div 
                      className="relative w-full aspect-video bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden cursor-crosshair group"
                      onMouseMove={(e) => {
                        if (e.buttons === 1) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                          const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                          setState(prev => ({ ...prev, lightPosition: { x, y } }));
                        }
                      }}
                      onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                        setState(prev => ({ ...prev, lightPosition: { x, y } }));
                      }}
                    >
                      {/* Grid Lines */}
                      <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                      </div>
                      
                      {/* Light Source Orb */}
                      <motion.div 
                        animate={{ 
                          left: `${state.lightPosition.x}%`, 
                          top: `${state.lightPosition.y}%`,
                          boxShadow: [
                            '0 0 20px rgba(255,255,255,0.5)',
                            '0 0 40px rgba(255,255,255,0.8)',
                            '0 0 20px rgba(255,255,255,0.5)'
                          ]
                        }}
                        transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
                        className="absolute w-6 h-6 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 z-10"
                      />
                      
                      {/* Light Beams (Decorative) */}
                      <div 
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{ 
                          background: `radial-gradient(circle at ${state.lightPosition.x}% ${state.lightPosition.y}%, white 0%, transparent 50%)`
                        }}
                      />

                      <div className="absolute bottom-2 right-2 text-[8px] font-bold text-zinc-600 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
                        Drag to position light
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-tight">
                      AI will calculate shadows and reflections based on this light source.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-2"><MousePointer2 className="w-3 h-3" /> Human Touch</span>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, addHumanTouch: !prev.addHumanTouch }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${state.addHumanTouch ? 'bg-white' : 'bg-zinc-800'}`}
                      >
                        <motion.div 
                          animate={{ x: state.addHumanTouch ? 22 : 2 }}
                          className={`absolute top-1 w-3 h-3 rounded-full ${state.addHumanTouch ? 'bg-black' : 'bg-zinc-500'}`}
                        />
                      </button>
                    </label>
                    <p className="text-[10px] text-zinc-500 leading-tight">
                      Adds a realistic human hand or person for scale and connection.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> Campaign Mode</span>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, isCampaignMode: !prev.isCampaignMode }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${state.isCampaignMode ? 'bg-white' : 'bg-zinc-800'}`}
                      >
                        <motion.div 
                          animate={{ x: state.isCampaignMode ? 22 : 2 }}
                          className={`absolute top-1 w-3 h-3 rounded-full ${state.isCampaignMode ? 'bg-black' : 'bg-zinc-500'}`}
                        />
                      </button>
                    </label>
                    <p className="text-[10px] text-zinc-500 leading-tight">
                      {state.isCampaignMode 
                        ? "Generates 4 distinct chapters: Teaser, Hero, Lifestyle, and Sale." 
                        : "Generates 4 high-quality variations of the same scene."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400">Target Platform</label>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors appearance-none"
                      onChange={(e) => setState(prev => ({ ...prev, targetPlatform: e.target.value as TargetPlatform }))}
                    >
                      <option value="Instagram">Instagram Feed</option>
                      <option value="Amazon">Amazon Listing</option>
                      <option value="Website Ads">Website Banner</option>
                    </select>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => generatePhotoshoot()}
                className="btn-primary w-full flex items-center justify-center gap-2 py-5"
              >
                Generate 4 Variations
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {state.step === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-12"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 rounded-full border-t-2 border-r-2 border-white/20 mx-auto"
              />
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-display font-semibold">✨ Creating your premium photoshoot...</h2>
              <div className="max-w-xs mx-auto space-y-4">
                {[
                  "Analyzing product details",
                  "Detecting category & context",
                  "Selecting best environment",
                  "Applying lighting & composition",
                  "Rendering 4 high-quality variations"
                ].map((step, i) => (
                  <motion.div 
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 1.5 }}
                    className="flex items-center gap-3 text-zinc-500 text-sm"
                  >
                    <motion.div
                      animate={{ 
                        backgroundColor: ["#27272a", "#ffffff", "#27272a"],
                      }}
                      transition={{ delay: i * 1.5, duration: 1.5 }}
                      className="w-2 h-2 rounded-full bg-zinc-800"
                    />
                    {step}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {state.step === 'result' && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-7xl grid lg:grid-cols-12 gap-12 items-start"
          >
            <div className="lg:col-span-7 space-y-6">
              <div className="relative group">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state.results[state.currentResultIndex]?.id + (showComparison ? '-comp' : '-res')}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className={`relative rounded-3xl overflow-hidden glass-panel border-white/10 shadow-2xl transition-all duration-500 ${isZoomed ? 'fixed inset-4 z-50 bg-black/95 p-4 flex items-center justify-center' : 'aspect-square'}`}
                  >
                    {showComparison ? (
                      <div className="grid grid-cols-2 h-full">
                        <div className="relative border-r border-white/10">
                          <img 
                            src={state.productImage!} 
                            alt="Original" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest">Original</div>
                        </div>
                        <div className="relative">
                          <img 
                            src={state.results[state.currentResultIndex]?.image} 
                            alt="Result" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4 px-3 py-1 bg-premium-gradient rounded-full text-[10px] font-bold uppercase tracking-widest">Enhanced</div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full h-full">
                        <img 
                          src={state.results[state.currentResultIndex]?.image} 
                          alt="Photoshoot Result" 
                          className={`w-full h-full object-cover ${isZoomed ? 'object-contain' : ''}`}
                          referrerPolicy="no-referrer"
                        />
                        {state.mockupMode !== 'none' && (
                          <MockupOverlay mode={state.mockupMode} image={state.results[state.currentResultIndex]?.image} />
                        )}
                        {state.showHeatmap && state.results[state.currentResultIndex]?.heatmapData && (
                          <HeatmapOverlay data={state.results[state.currentResultIndex].heatmapData!} />
                        )}
                      </div>
                    )}

                    {/* Image Controls Overlay */}
                    <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setState(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }))}
                        className={`p-3 rounded-full backdrop-blur-xl transition-all ${state.showHeatmap ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}
                        title="AI Eye-Tracking Heatmap"
                      >
                        <Target className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, showGrid: true }))}
                        className="p-3 rounded-full backdrop-blur-xl bg-black/40 text-white hover:bg-black/60 transition-all"
                        title="Studio Grid View"
                      >
                        <Grid className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setShowComparison(!showComparison)}
                        className={`p-3 rounded-full backdrop-blur-xl transition-all ${showComparison ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-black/60'}`}
                        title="Compare with Original"
                      >
                        <Split className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setIsZoomed(!isZoomed)}
                        className={`p-3 rounded-full backdrop-blur-xl transition-all ${isZoomed ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-black/60'}`}
                        title="Toggle Zoom"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Grid View Overlay */}
                <AnimatePresence>
                  {state.showGrid && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl p-8 flex flex-col items-center justify-center"
                    >
                      <div className="w-full max-w-4xl grid grid-cols-2 gap-4">
                        {state.results.map((res, idx) => (
                          <motion.div
                            key={res.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setState(prev => ({ ...prev, currentResultIndex: idx, showGrid: false }))}
                            className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 border-white/10 hover:border-white/40 transition-all"
                          >
                            <img src={res.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-4 left-4">
                              <span className="text-xs font-bold text-white uppercase tracking-widest">Variation {idx + 1}</span>
                              {res.chapter && <p className="text-lg font-display font-bold text-white">{res.chapter}</p>}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, showGrid: false }))}
                        className="mt-8 px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
                      >
                        Close Grid View
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Variation Grid Selector */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  {state.results.map((res, idx) => (
                    <button
                      key={res.id}
                      onClick={() => setState(prev => ({ ...prev, currentResultIndex: idx }))}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${state.currentResultIndex === idx ? 'border-white scale-105 shadow-xl' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-102'}`}
                    >
                      <img src={res.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 flex flex-col items-start">
                        <span className="text-[8px] font-bold text-white/60 uppercase tracking-tighter">#{idx + 1}</span>
                        {res.chapter && <span className="text-[10px] font-bold text-white uppercase tracking-tighter leading-none">{res.chapter}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mockup Selector */}
              <div className="glass-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layout className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Live Mockup Preview</span>
                </div>
                <div className="flex gap-2">
                  {[
                    { id: 'none', icon: Maximize2, label: 'None' },
                    { id: 'instagram', icon: Smartphone, label: 'Insta' },
                    { id: 'facebook', icon: Facebook, label: 'FB' },
                    { id: 'amazon', icon: ShoppingBag, label: 'Amazon' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setState(prev => ({ ...prev, mockupMode: m.id as any }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${
                        state.mockupMode === m.id 
                          ? 'bg-white text-black' 
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <m.icon className="w-3 h-3" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => downloadImage(state.results[state.currentResultIndex].image)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-4"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
                <button 
                  onClick={downloadAll}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2 py-4"
                >
                  <DownloadCloud className="w-5 h-5" />
                  Save All
                </button>
              </div>

              <button 
                onClick={() => setState(prev => ({ ...prev, step: 'input', results: [], currentResultIndex: 0 }))}
                className="w-full py-4 glass-panel border-white/5 hover:border-white/20 text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs"
              >
                <RefreshCw className="w-4 h-4" />
                Start New Session
              </button>

              {/* Refine Section */}
              <div className="glass-panel p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 uppercase tracking-widest">
                    <MessageSquare className="w-4 h-4" />
                    Refine with AI
                  </div>
                  <div className="flex items-center gap-2">
                    <Brush className="w-3 h-3 text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase">Material Swap</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {['Marble', 'Dark Wood', 'Water', 'Sand', 'Silk', 'Concrete'].map(mat => (
                    <button
                      key={mat}
                      onClick={() => {
                        setRefineInput(`Change the surface material to ${mat}`);
                        setTimeout(() => generatePhotoshoot(true), 100);
                      }}
                      className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400 hover:border-zinc-500 hover:text-white transition-all"
                    >
                      {mat}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sun className="w-3 h-3 text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase">Lighting Studio</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'rim-light', label: 'Rim Light' },
                      { id: 'spotlight', label: 'Spotlight' },
                      { id: 'neon-glow', label: 'Neon Glow' },
                      { id: 'caustics', label: 'Water Caustics' }
                    ].map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          setState(prev => ({ ...prev, activeAccent: acc.id as any }));
                          setRefineInput(`Add a professional ${acc.label} effect to the product`);
                          setTimeout(() => generatePhotoshoot(true), 100);
                        }}
                        className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold transition-all ${
                          state.activeAccent === acc.id 
                            ? 'bg-white text-black border-white' 
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-500 hover:text-white'
                        }`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <input 
                    type="text"
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    placeholder="e.g. 'Make the lighting warmer' or 'Add more marble textures'"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                  <button 
                    onClick={() => generatePhotoshoot(true)}
                    disabled={!refineInput}
                    className="px-6 py-3 bg-white text-black font-bold rounded-xl disabled:opacity-50"
                  >
                    Refine
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-8">
              {/* Marketing Auditor Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-8 border-white/20 bg-premium-gradient relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BarChart3 className="w-24 h-24" />
                </div>
                <div className="relative space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/60">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Marketing Auditor</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                      <span className="text-xs font-bold text-white">Score:</span>
                      <span className="text-sm font-display font-bold text-white">{state.results[state.currentResultIndex]?.score || 0}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-end gap-2">
                      <h3 className="text-5xl font-display font-bold text-white">{state.results[state.currentResultIndex]?.score || 0}</h3>
                      <span className="text-white/40 font-bold mb-1">/ 100</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${state.results[state.currentResultIndex]?.score || 0}%` }}
                        className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                      />
                    </div>
                  </div>

                  <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                    <p className="text-sm text-white/80 leading-relaxed">
                      <Sparkles className="w-4 h-4 inline-block mr-2 text-white" />
                      {state.results[state.currentResultIndex]?.analysis || "Analyzing conversion potential..."}
                    </p>
                  </div>

                  {/* Heatmap Analysis Section */}
                  {state.showHeatmap && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-red-400">
                        <Target className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Attention Analysis</span>
                      </div>
                      <p className="text-[11px] text-red-200/80 leading-relaxed">
                        The heatmap shows the "Hot Zones" where customers will look in the first 2 seconds. 
                        {state.results[state.currentResultIndex]?.score! > 80 
                          ? " High attention on product logo and key features detected." 
                          : " Attention is scattered; consider a tighter crop or more contrast."}
                      </p>
                    </motion.div>
                  )}

                  {/* Synthetic Focus Group */}
                  <div className="pt-4 space-y-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white/60">
                        <User className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Synthetic Focus Group</span>
                      </div>
                      {!state.results[state.currentResultIndex]?.score && (
                        <button 
                          onClick={() => generateAnalysis(state.results[state.currentResultIndex].id, state.results[state.currentResultIndex].image)}
                          disabled={state.results[state.currentResultIndex]?.isAnalyzing}
                          className="text-[10px] font-bold text-white bg-white/10 px-3 py-1 rounded-full hover:bg-white/20 transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          {state.results[state.currentResultIndex]?.isAnalyzing ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3" />
                              Run AI Audit
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="space-y-4">
                      {state.results[state.currentResultIndex]?.focusGroup?.map((persona, idx) => (
                        <motion.div 
                          key={persona.name}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + (idx * 0.1) }}
                          className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                                {persona.name.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">{persona.name}</span>
                                <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">Persona Analysis</span>
                              </div>
                            </div>
                            <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              persona.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                              persona.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                              'bg-zinc-500/20 text-zinc-400'
                            }`}>
                              {persona.sentiment}
                            </div>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed font-medium italic">
                            "{persona.feedback}"
                          </p>
                        </motion.div>
                      ))}
                      {(!state.results[state.currentResultIndex]?.focusGroup || state.results[state.currentResultIndex]?.focusGroup.length === 0) && (
                        <div className="text-center py-8 bg-black/20 rounded-2xl border border-dashed border-white/5">
                          <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">
                            {state.results[state.currentResultIndex]?.isAnalyzing ? "AI is processing audience response..." : state.results[state.currentResultIndex]?.score === 0 ? "Audit required for this variation" : "Simulating audience response..."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" />
                    Variation {state.currentResultIndex + 1}
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setState(prev => ({ ...prev, step: 'input' }))}
                      className="text-zinc-500 hover:text-white transition-colors"
                      title="New Session"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setShowHistory(true)}
                      className="text-zinc-500 hover:text-white transition-colors"
                      title="View History"
                    >
                      <History className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <h2 className="text-4xl font-display font-bold">Photoshoot Ready</h2>
                <p className="text-zinc-400">High-conversion marketing assets generated for your brand.</p>
              </div>

              <div className="space-y-6">
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Instagram Caption</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(state.results[state.currentResultIndex]?.caption?.instagram || '', 'instagram')}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                      {copiedField === 'instagram' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed italic">
                    "{state.results[state.currentResultIndex]?.caption?.instagram || 'Generating caption...'}"
                  </p>
                </div>

                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Ad Copy Line</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(state.results[state.currentResultIndex]?.caption?.adCopy || '', 'adCopy')}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                      {copiedField === 'adCopy' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {state.results[state.currentResultIndex]?.caption?.adCopy || 'Generating copy...'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-panel p-4">
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Visual Style</span>
                    <span className="text-sm font-medium">{state.results[state.currentResultIndex]?.style}</span>
                  </div>
                  <div className="glass-panel p-4">
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Lighting</span>
                    <span className="text-sm font-medium">{state.results[state.currentResultIndex]?.lighting}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decorative Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}

function MockupOverlay({ mode, image }: { mode: string, image: string }) {
  if (mode === 'instagram') {
    return (
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 z-10 backdrop-blur-sm">
        <div className="w-[280px] aspect-[9/16] bg-black rounded-[2.5rem] border-[8px] border-zinc-900 shadow-2xl overflow-hidden relative flex flex-col">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-900 rounded-b-2xl z-20" />
          
          {/* Header */}
          <div className="p-4 pt-8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-black border-2 border-black overflow-hidden">
                <div className="w-full h-full bg-zinc-800" />
              </div>
            </div>
            <div className="flex-1">
              <div className="h-2 w-20 bg-zinc-800 rounded-full mb-1" />
              <div className="h-1.5 w-12 bg-zinc-900 rounded-full" />
            </div>
          </div>

          {/* Main Image */}
          <div className="flex-1 bg-zinc-900 relative overflow-hidden">
            <img src={image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            
            {/* Ad Overlay */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent space-y-3">
              <div className="flex gap-4">
                <div className="w-5 h-5 rounded-md border-2 border-white/60" />
                <div className="w-5 h-5 rounded-md border-2 border-white/60" />
                <div className="w-5 h-5 rounded-md border-2 border-white/60" />
              </div>
              <div className="w-full py-2.5 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20">
                Shop Now
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="h-12 border-t border-white/5 flex items-center justify-around px-4">
            <div className="w-5 h-5 rounded bg-zinc-800" />
            <div className="w-5 h-5 rounded bg-zinc-800" />
            <div className="w-5 h-5 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'facebook') {
    return (
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 z-10 backdrop-blur-sm">
        <div className="w-full max-w-[400px] bg-zinc-900 rounded-xl shadow-2xl overflow-hidden border border-white/10 flex flex-col">
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">f</div>
            <div>
              <div className="h-3 w-32 bg-zinc-800 rounded-full mb-1" />
              <div className="h-2 w-20 bg-zinc-900 rounded-full" />
            </div>
          </div>
          <div className="px-4 pb-3 space-y-2">
            <div className="h-2 w-full bg-zinc-800 rounded-full" />
            <div className="h-2 w-2/3 bg-zinc-800 rounded-full" />
          </div>
          <div className="aspect-[1.91/1] bg-black">
            <img src={image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="p-4 bg-zinc-800 flex justify-between items-center border-t border-white/5">
            <div>
              <div className="h-3 w-40 bg-zinc-700 rounded-full mb-1" />
              <div className="h-2 w-24 bg-zinc-900 rounded-full" />
            </div>
            <div className="px-4 py-2 bg-zinc-700 rounded-md font-bold text-[10px] uppercase tracking-wider">Learn More</div>
          </div>
          <div className="h-10 flex items-center justify-around px-4 border-t border-white/5">
            <div className="w-4 h-4 rounded bg-zinc-800" />
            <div className="w-4 h-4 rounded bg-zinc-800" />
            <div className="w-4 h-4 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'amazon') {
    return (
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 z-10 backdrop-blur-sm">
        <div className="w-full max-w-[500px] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row border border-zinc-200">
          <div className="md:w-1/2 aspect-square bg-white p-6 flex items-center justify-center">
            <img src={image} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="md:w-1/2 p-6 space-y-5 text-black bg-zinc-50 border-l border-zinc-200">
            <div className="space-y-2">
              <div className="h-4 w-full bg-zinc-200 rounded" />
              <div className="h-4 w-3/4 bg-zinc-200 rounded" />
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <div key={i} className="w-3 h-3 bg-orange-400 rounded-sm" />)}
              <div className="w-12 h-3 bg-zinc-200 rounded ml-2" />
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold">$99.99</div>
              <div className="text-[10px] text-zinc-500 font-medium">FREE Returns & Delivery</div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="w-full h-10 bg-yellow-400 hover:bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-colors cursor-pointer">Add to Cart</div>
              <div className="w-full h-10 bg-orange-400 hover:bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-colors cursor-pointer">Buy Now</div>
            </div>
            <div className="pt-2 flex items-center gap-2 text-[10px] text-zinc-500">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              In Stock.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function HeatmapOverlay({ data }: { data: any[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 mix-blend-screen opacity-70">
      {data.map((point, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: point.intensity }}
          transition={{ delay: i * 0.1, duration: 1 }}
          className="absolute rounded-full"
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: `${point.intensity * 200}px`,
            height: `${point.intensity * 200}px`,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, 
              rgba(255, 0, 0, 0.8) 0%, 
              rgba(255, 165, 0, 0.4) 40%, 
              rgba(255, 255, 0, 0.1) 70%, 
              transparent 100%)`,
            filter: 'blur(20px)'
          }}
        />
      ))}
      <div className="absolute inset-0 bg-red-500/5 backdrop-blur-[1px]" />
    </div>
  );
}
