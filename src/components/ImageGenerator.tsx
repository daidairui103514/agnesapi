import React, { useState } from 'react';
import { ImageIcon, Loader2, Upload, X, History, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import type { GenerationStatus, ImageHistoryItem } from '../types';
import { useHistory } from '../hooks/useHistory';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';

export function ImageGenerator({ apiKey }: { apiKey: string }) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [resultImage, setResultImage] = useState<string | null>(null);
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

    try {
      const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
      const body: any = {
        model: 'agnes-image-2.1-flash',
        prompt: prompt.trim(),
        size,
        extra_body: {
          response_format: 'url'
        }
      };

      if (referenceImage) {
        body.image = [referenceImage];
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end relative z-10 -mb-5 pr-2">
         <button
            onClick={() => setShowHistory(!showHistory)}
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
                       className="group relative rounded-[16px] border border-[rgba(0,0,0,0.05)] bg-[#f5f5f7] overflow-hidden hover:bg-white hover:shadow-sm transition-all flex h-24"
                    >
                      <img src={item.url} className="w-24 h-24 object-cover shrink-0 bg-[#e8e8ed]" alt={item.prompt} />
                      <div className="p-3 flex-1 min-w-0 flex flex-col">
                         <p className="text-[13px] text-[#1d1d1f] line-clamp-2 flex-1" title={item.prompt}>{item.prompt}</p>
                         <div className="flex justify-between items-end mt-2">
                           <span className="text-[11px] text-[#86868b] font-mono">{new Date(item.timestamp).toLocaleString()}</span>
                           <div className="flex gap-1">
                              <button
                                onClick={() => removeHistory(item.id)}
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
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">图片比例</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                disabled={status === 'loading'}
                className="w-full px-4 py-3 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#d95d39]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
              >
                <option value="1024x1024">默认正方形 (1:1)</option>
                <option value="1024x768">横向宽屏 (4:3)</option>
                <option value="768x1024">竖向画幅 (3:4)</option>
                <option value="1152x768">全景宽幅 (16:9)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2 mt-4">图像灵感 (可选)</label>
            {referenceImage ? (
              <div className="relative inline-block border border-[rgba(0,0,0,0.05)] rounded-[16px] overflow-hidden mt-2 p-1 bg-[#f5f5f7]">
                <img src={referenceImage} alt="Reference" className="h-32 object-contain bg-white rounded-[12px]" />
                <button
                  onClick={() => setReferenceImage(null)}
                  className="absolute top-3 right-3 p-1.5 bg-white/80 backdrop-blur-md hover:bg-white text-[#1d1d1f] rounded-full shadow-sm transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-[rgba(0,0,0,0.15)] rounded-[16px] p-8 text-center hover:border-[#d95d39]/40 transition-colors bg-[#f5f5f7]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={status === 'loading'}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-3 text-[#86868b] hover:text-[#1d1d1f] transition-colors">
                  <div className="w-10 h-10 bg-white shadow-sm flex items-center justify-center rounded-full">
                    <Upload size={18} />
                  </div>
                  <span className="text-[14px] font-medium">点击上传参考图</span>
                </label>
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
          {status === 'idle' && !resultImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[#86868b] flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center">
                 <ImageIcon size={24} className="opacity-50" />
              </div>
              <p className="text-[15px]">生成的图像将在这边呈现</p>
            </motion.div>
          )}

          {status === 'loading' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-[#d95d39]">
              <Loader2 size={36} className="animate-spin" />
              <p className="text-[15px] font-medium">正在挥洒创意...</p>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-[#ff3b30] bg-[#ff3b30]/5 p-5 rounded-[16px] max-w-sm text-center">
              <h3 className="font-semibold text-[15px] mb-1">生成遇到了问题</h3>
              <p className="text-[13px] opacity-90">{errorMsg}</p>
            </motion.div>
          )}

          {status === 'success' && resultImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-center relative group">
              <img 
                src={resultImage} 
                alt="Generated Result" 
                className="max-w-full max-h-[600px] object-contain rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-white"
              />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={resultImage} 
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
