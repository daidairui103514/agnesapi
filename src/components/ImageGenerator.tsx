import React, { useState } from 'react';
import { ImageIcon, Loader2, Upload, X, History, Plus, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { GenerationStatus, ImageHistoryItem } from '../types';
import { useHistory } from '../hooks/useHistory';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';

export function ImageGenerator({ apiKey }: { apiKey: string }) {
  const [prompt, setPrompt] = useState('');
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [referenceImage, setReferenceImage] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultPrompt, setResultPrompt] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<{url: string, prompt: string} | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { history, addHistory, removeHistory } = useHistory<ImageHistoryItem>('agnes_image_history');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !apiKey) return;
    
    setStatus('loading');
    setErrorMsg('');
    setResultImage(null);
    setResultPrompt('');

    try {
      const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
      const body: any = {
        model: 'agnes-image-2.1-flash',
        prompt: prompt.trim(),
        size: `${width}x${height}`,
        extra_body: {
          response_format: 'b64_json'
        }
      };

      if (referenceImage) {
        if (referenceImage.startsWith('data:')) {
          body.image = referenceImage;
        } else {
          const urls = referenceImage.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
          if (urls.length > 0) {
            body.image = urls[0];
          }
        }
      }

      const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errStr = `API Error ${response.status}`;
        try {
          const errData = await response.json();
          errStr = errData.error?.message || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      const data = await response.json();
      const imgUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
      
      if (!imgUrl) throw new Error('No image returned from API');
      
      let finalUrl = imgUrl;
      if (imgUrl.startsWith('http')) {
         finalUrl = imgUrl;
      } else {
         finalUrl = `data:image/png;base64,${imgUrl}`;
      }
      setResultImage(finalUrl);
      setResultPrompt(prompt.trim());

      addHistory({
         id: uuidv4(),
         prompt: prompt.trim(),
         url: finalUrl,
         timestamp: Date.now()
      });

      setStatus('success');
    } catch (error: any) {
      setErrorMsg(error.message);
      setStatus('error');
    }
  };

  const displayStatus = previewItem ? 'success' : status;
  const displayImage = previewItem ? previewItem.url : resultImage;
  const displayPrompt = previewItem ? previewItem.prompt : resultPrompt;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end relative z-10 -mb-5 pr-2">
         <button
            onClick={() => {
              if (showHistory) setPreviewItem(null);
              setShowHistory(!showHistory);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all shadow-sm border",
              showHistory ? "bg-[#d95d39]/10 text-[#d95d39] border-[#d95d39]/20" : "bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border-[rgba(0,0,0,0.05)]"
            )}
         >
           <History size={14} />
           {showHistory ? "隐藏记录" : "生成记录"}
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-start">
        {showHistory ? (
           <motion.div 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             className="bg-white p-6 rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col h-[600px] lg:h-[700px]"
           >
              <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight mb-4 flex items-center gap-2 border-b border-[rgba(0,0,0,0.05)] pb-4">
                <History className="text-[#d95d39]" size={18} />
                图像生成记录
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#86868b]">
                    <ImageIcon size={32} className="opacity-20 mb-3" />
                    <p className="text-[14px]">暂无历史记录</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <motion.div 
                       key={item.id} 
                       layout
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className={cn("group relative rounded-[16px] border border-[rgba(0,0,0,0.05)] overflow-hidden transition-all flex h-24 hover:cursor-pointer",
                          previewItem?.url === item.url ? "bg-white shadow-sm ring-2 ring-[#d95d39]/30" : "bg-[#f5f5f7] hover:bg-white hover:shadow-sm"
                       )}
                       onClick={() => {
                         setPreviewItem({url: item.url, prompt: item.prompt});
                       }}
                    >
                      <img src={item.url} className="w-24 h-24 object-cover shrink-0 bg-[#e8e8ed]" alt={item.prompt} />
                      <div className="p-3 flex-1 min-w-0 flex flex-col pointer-events-none">
                         <p className="text-[13px] text-[#1d1d1f] line-clamp-2 flex-1" title={item.prompt}>{item.prompt}</p>
                         <div className="flex justify-between items-end mt-2">
                           <span className="text-[11px] text-[#86868b] font-mono">{new Date(item.timestamp).toLocaleString()}</span>
                           <div className="flex gap-1 pointer-events-auto">
                              <button
                                onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }}
                                className="opacity-0 group-hover:opacity-100 text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 p-1.5 rounded-full transition-all"
                              >
                                <X size={14} />
                              </button>
                           </div>
                         </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
           </motion.div>
        ) : (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 sm:p-8 rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-6 flex flex-col h-[600px] lg:h-[700px] overflow-y-auto custom-scrollbar"
        >
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">提示词</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={status === 'loading'}
              placeholder="描述您想要生成的画面细节..."
              className="w-full p-4 bg-[#f5f5f7] border border-transparent rounded-[16px] focus:outline-none focus:ring-2 focus:ring-[#d95d39]/30 focus:border-transparent min-h-[140px] resize-y disabled:opacity-50 text-[15px] text-[#1d1d1f] placeholder-[#86868b] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
               <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-3">常用比例</label>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                 {[
                   { label: '1080x1080 (1:1)', w: 1080, h: 1080 },
                   { label: '1440x1080 (4:3)', w: 1440, h: 1080 },
                   { label: '1080x1440 (3:4)', w: 1080, h: 1440 },
                   { label: '1920x1080 (16:9)', w: 1920, h: 1080 },
                   { label: '1080x1920 (9:16)', w: 1080, h: 1920 },
                   { label: '3840x2160 (4K)', w: 3840, h: 2160 }
                 ].map(t => (
                    <button
                      key={t.w + 'x' + t.h}
                      onClick={(e) => { e.preventDefault(); setWidth(t.w); setHeight(t.h); }}
                      className={cn(
                        "text-[12px] py-2 rounded-[8px] transition-all font-medium border flex items-center justify-center font-mono tracking-tight",
                        width === t.w && height === t.h 
                          ? "bg-[#d95d39] text-white border-[#d95d39] shadow-[0_2px_10px_rgba(217,93,57,0.2)]" 
                          : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border-transparent"
                      )}
                    >
                      {t.label}
                    </button>
                 ))}
               </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">图像宽度</label>
              <input
                type="number"
                step="64"
                min="256"
                max="4096"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                disabled={status === 'loading'}
                className="w-full px-4 py-3 bg-[#f5f5f7] border border-[rgba(0,0,0,0.05)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#d95d39]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">图像高度</label>
              <input
                type="number"
                step="64"
                min="256"
                max="4096"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                disabled={status === 'loading'}
                className="w-full px-4 py-3 bg-[#f5f5f7] border border-[rgba(0,0,0,0.05)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#d95d39]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2 mt-4">图像灵感 (可选)</label>
            {referenceImage && (referenceImage.startsWith('data:') || referenceImage.startsWith('http')) ? (
              <div className="relative inline-block border border-[rgba(0,0,0,0.05)] rounded-[16px] overflow-hidden mt-2 p-1 bg-[#f5f5f7]">
                <img src={referenceImage.split(/[\n,]+/)[0].trim()} alt="Reference" className="h-32 object-contain bg-white rounded-[12px]" />
                <button
                  onClick={() => setReferenceImage('')}
                  className="absolute top-3 right-3 p-1.5 bg-white/80 backdrop-blur-md hover:bg-white text-[#1d1d1f] rounded-full shadow-sm transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={referenceImage}
                  onChange={(e) => setReferenceImage(e.target.value)}
                  disabled={status === 'loading'}
                  rows={2}
                  placeholder="支持贴入图片URL用于图生图，或点击下方上传本地图片..."
                  className="w-full p-3.5 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#d95d39]/30 focus:border-transparent disabled:opacity-50 text-[14px] text-[#1d1d1f] placeholder-[#86868b] transition-all resize-none"
                />
                <div className="mt-2 flex justify-start">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={status === 'loading'}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] rounded-[8px] cursor-pointer text-[12px] font-medium transition-colors">
                    <Upload size={14} />
                    上传本地图片
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || !apiKey || status === 'loading'}
            className="w-full py-3.5 bg-[#d95d39] text-white rounded-full text-[15px] font-medium shadow-sm hover:bg-[#c24b2b] disabled:opacity-50 disabled:hover:bg-[#d95d39] transition-all flex items-center justify-center gap-2 mt-auto"
          >
            {status === 'loading' ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                正在生成图像...
              </>
            ) : (
              <>
                <ImageIcon size={18} />
                生成图像
              </>
            )}
          </button>

          {!apiKey && (
             <p className="text-[12px] text-[#ff3b30] text-center font-medium">需要配置 API Key 才能生成图像</p>
          )}
        </motion.div>
        )}

        {/* Result Display */}
        <div className="bg-white rounded-[24px] border border-[rgba(0,0,0,0.05)] p-6 sm:p-8 flex flex-col items-center justify-center h-[600px] lg:h-[700px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative">
          <AnimatePresence mode="wait">
          {displayStatus === 'idle' && !displayImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[#86868b] flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center">
                 <ImageIcon size={24} className="opacity-50" />
              </div>
              <p className="text-[15px]">生成的图像将在这边呈现</p>
            </motion.div>
          )}

          {displayStatus === 'loading' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-[#d95d39]">
              <Loader2 size={36} className="animate-spin" />
              <p className="text-[15px] font-medium">正在挥洒创意...</p>
            </motion.div>
          )}

          {displayStatus === 'error' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-[#ff3b30] bg-[#ff3b30]/5 p-5 rounded-[16px] max-w-sm text-center">
              <h3 className="font-semibold text-[15px] mb-1">生成遇到了问题</h3>
              <p className="text-[13px] opacity-90">{errorMsg}</p>
            </motion.div>
          )}

          {displayStatus === 'success' && displayImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col items-center justify-center relative group">
              <img 
                src={displayImage} 
                alt="Generated Result" 
                className="max-w-full max-h-[500px] object-contain rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-white"
              />
              {displayPrompt && (
                <div className="mt-6 px-4 py-3 bg-[#f5f5f7] rounded-[12px] max-w-full text-[13px] text-[#1d1d1f] shadow-sm max-h-[100px] overflow-y-auto w-[80%] break-words custom-scrollbar">
                  {displayPrompt}
                </div>
              )}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={displayImage} 
                  download="agnes-image.png" 
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/90 text-[#1d1d1f] px-4 py-2 rounded-full text-[13px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:scale-105 transition-all backdrop-blur-sm"
                >
                  存储图像
                </a>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
