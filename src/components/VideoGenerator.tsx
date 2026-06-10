import React, { useState, useEffect, useRef } from 'react';
import { Video, Loader2, Upload, Play, Clock, AlertCircle, History, X, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { GenerationStatus, VideoHistoryItem } from '../types';
import { useHistory } from '../hooks/useHistory';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';

export function VideoGenerator({ apiKey, baseUrl }: { apiKey: string, baseUrl?: string }) {
  const [prompt, setPrompt] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [numFrames, setNumFrames] = useState(121);
  const [frameRate, setFrameRate] = useState(24);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1088);
  const [mode, setMode] = useState('standard');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [resultPrompt, setResultPrompt] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<{url: string, prompt: string, taskId?: string} | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [pollLog, setPollLog] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [queryTaskId, setQueryTaskId] = useState('');

  const { history, addHistory, removeHistory } = useHistory<VideoHistoryItem>('agnes_video_history');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string) => {
    setPollLog(prev => {
      const timeStr = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]`;
      const lastLine = prev[prev.length - 1];
      if (lastLine) {
        // Extract message from last line (after the timestamp)
        const lastMsgMatch = lastLine.match(/\[.*?\]\s(.*)/);
        if (lastMsgMatch) {
           let lastMsg = lastMsgMatch[1];
           // Remove existing counter if any
           lastMsg = lastMsg.replace(/\s\(\d+次\)$/, '');
           if (lastMsg === msg) {
             const cntMatch = lastLine.match(/\((\d+)次\)$/);
             const count = cntMatch ? parseInt(cntMatch[1], 10) + 1 : 2;
             return [...prev.slice(0, -1), `${timeStr} ${msg} (${count}次)`];
           }
        }
      }
      return [...prev, `${timeStr} ${msg}`];
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !apiKey) return;
    
    setStatus('loading');
    setErrorMsg('');
    setResultVideo(null);
    setResultPrompt('');
    setTaskId(null);
    setPollLog([]);
    lastStatusRef.current = null;
    addLog('正在提交视频生成任务...');

    try {
      const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
      const targetBaseUrl = baseUrl || 'https://apihub.agnes-ai.com/v1';

      if (targetBaseUrl.includes('ranmeng')) {
        throw new Error('此接口不支持视频生成，请切换至默认的 Agnes API');
      }

      const body: any = {
        model: 'agnes-video-v2.0',
        prompt: prompt.trim(),
        num_frames: numFrames,
        frame_rate: frameRate,
        height: height,
        width: width
      };

      const urls = imageUrls.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);

      if (mode === 'keyframes') {
        body.extra_body = { mode: 'keyframes' };
        if (urls.length > 0) {
          body.extra_body.image = urls;
        }
      } else {
        if (urls.length > 1) {
          body.extra_body = { image: urls };
        } else if (urls.length === 1) {
          body.image = urls[0];
        }
      }

      const response = await fetch(`/api/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`,
          'x-target-url': `${targetBaseUrl}/videos`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API 调用错误 ${response.status}`);
      }

      const data = await response.json();
      
      const currentTaskId = data.task_id || data.id || data.data?.task_id || data.body?.id;
      if (!currentTaskId) {
        throw new Error('响应中未找到任务 ID (task_id)');
      }

      setTaskId(currentTaskId);
      addLog(`任务创建成功，任务 ID: ${currentTaskId}`);
      
    } catch (error: any) {
      setErrorMsg(error.message);
      setStatus('error');
      addLog(`执行报错: ${error.message}`);
    }
  };

  const lastStatusRef = useRef<string | null>(null);

  const checkStatus = async (currentTaskId: string) => {
    try {
      const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
      const targetBaseUrl = baseUrl || 'https://apihub.agnes-ai.com/v1';
      const response = await fetch(`/api/proxy`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'x-target-url': `${targetBaseUrl}/videos/${currentTaskId}`,
        }
      });

      if (!response.ok) {
        addLog(`查询报错: ${response.status}`);
        return;
      }

      const data = await response.json();
      const st = data.status || data.state || data.body?.status;
      
      const statusMap: Record<string, string> = {
        'queued': '排队中，请稍候...',
        'processing': '处理中...',
        'generating': '生成资源中...',
        'running': '正在渲染...',
        'completed': '任务已完成',
        'succeeded': '请求成功',
        'failed': '处理失败',
        'error': '发生错误'
      };

      if (st) {
         const displaySt = statusMap[st.toLowerCase()] || st;
         addLog(`当前状态: ${displaySt}`);
      } else {
         addLog(`正在检查... 等待状态返回。`);
      }

      const isSuccess = st === 'SUCCESS' || st === 'COMPLETED' || st === 'completed' || st === 'succeeded';
      const isFailed = st === 'FAILED' || st === 'ERROR' || st === 'failed';

      if (isSuccess) {
        let url = data.video_url || data.result?.url || data.url || data.data?.url || data.output?.video_url || data.data?.[0]?.url || data.remixed_from_video_id || data.body?.remixed_from_video_id || data.body?.video_url;
        
        if (!url) {
           const jsonStr = JSON.stringify(data);
           const match = jsonStr.match(/https:\/\/[^"']*?\.mp4/);
           if (match) url = match[0];
        }

        if (url) {
          addLog('视频生成成功！');
          setResultVideo(url);
          setResultPrompt(prompt.trim() || '视频生成');
          setStatus('success');
          
          addHistory({
             id: uuidv4(),
             prompt: prompt.trim(),
             url,
             timestamp: Date.now(),
             taskId: currentTaskId
          });
        } else {
          addLog('状态为成功，但在响应中未找到视频链接。');
          setErrorMsg('任务已完成，但缺少视频 URL。');
          setStatus('error');
        }
        
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      } else if (isFailed) {
        addLog('视频生成任务失败。');
        setErrorMsg(data.error || '生成失败');
        setStatus('error');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }

    } catch (err: any) {
      addLog(`查询异常: ${err.message}`);
    }
  };

  useEffect(() => {
    if (status === 'loading' && taskId) {
      pollIntervalRef.current = setInterval(() => checkStatus(taskId), 10000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [taskId, status]);

  const estDuration = (numFrames / frameRate).toFixed(1);

  const displayStatus = previewItem ? 'success' : status;
  const displayVideo = previewItem ? previewItem.url : resultVideo;
  const displayPrompt = previewItem ? previewItem.prompt : resultPrompt;
  const displayTaskId = previewItem ? previewItem.taskId : taskId;
  const showLogs = !previewItem && (status === 'loading' || pollLog.length > 0);
  
  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end gap-3 relative z-10 -mb-5 pr-2">
         <div className="flex items-center bg-white border border-[rgba(0,0,0,0.05)] rounded-full px-2 py-1 shadow-sm h-[32px]">
           <input
             type="text"
             value={queryTaskId}
             onChange={(e) => setQueryTaskId(e.target.value)}
             placeholder="输入任务 ID 恢复查询..."
             disabled={!apiKey}
             className="text-[12px] bg-transparent outline-none w-[150px] px-2 text-[#1d1d1f] placeholder:text-[#86868b] disabled:opacity-50"
           />
           <button
             onClick={() => {
               if (!queryTaskId.trim() || !apiKey) return;
               setPrompt('（按任务ID恢复查询）');
               setTaskId(queryTaskId.trim());
               setStatus('loading');
               setResultVideo(null);
               setResultPrompt('');
               setPollLog([`开始恢复任务查询，任务 ID: ${queryTaskId.trim()}`]);
               setQueryTaskId('');
               setPreviewItem(null);
             }}
             disabled={!apiKey || !queryTaskId.trim() || status === 'loading'}
             className="text-[12px] text-[#8c52ff] font-medium px-2 border-l border-[rgba(0,0,0,0.05)] hover:opacity-80 transition-opacity disabled:opacity-50"
           >
             查询
           </button>
         </div>
         <button
            onClick={() => {
              if (showHistory) setPreviewItem(null);
              setShowHistory(!showHistory);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all shadow-sm border",
              showHistory ? "bg-[#8c52ff]/10 text-[#8c52ff] border-[#8c52ff]/20" : "bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border-[rgba(0,0,0,0.05)]"
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
                <History className="text-[#8c52ff]" size={18} />
                视频生成记录
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#86868b]">
                    <Clock size={32} className="opacity-20 mb-3" />
                    <p className="text-[14px]">暂无历史记录</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <motion.div 
                       key={item.id} 
                       layout
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className={cn("group relative rounded-[16px] border border-[rgba(0,0,0,0.05)] overflow-hidden transition-all flex hover:cursor-pointer",
                          previewItem?.url === item.url ? "bg-white shadow-sm ring-2 ring-[#8c52ff]/30" : "bg-[#f5f5f7] hover:bg-white hover:shadow-sm"
                       )}
                       onClick={() => {
                         setPreviewItem({url: item.url, prompt: item.prompt, taskId: item.taskId});
                       }}
                    >
                      <video src={item.url} className="w-32 h-24 object-cover shrink-0 bg-[#e8e8ed]" muted />
                      <div className="p-3 flex-1 min-w-0 flex flex-col pointer-events-none">
                         {item.taskId && (
                           <div className="text-[10px] text-[#8c52ff] bg-[#8c52ff]/10 px-1.5 py-0.5 rounded-[4px] self-start mb-1 font-mono break-all inline-block pointer-events-auto cursor-text select-text" title="任务 ID">
                             ID: {item.taskId}
                           </div>
                         )}
                         <p className="text-[13px] text-[#1d1d1f] line-clamp-3 flex-1" title={item.prompt}>{item.prompt}</p>
                         <div className="flex justify-between items-end mt-2">
                           <span className="text-[11px] text-[#86868b] font-mono">{new Date(item.timestamp).toLocaleString()}</span>
                           <div className="flex gap-1 pointer-events-auto">
                              <a 
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 text-[#86868b] hover:text-[#8c52ff] hover:bg-[#8c52ff]/10 p-1.5 rounded-full transition-all"
                              >
                                 <Play size={14} />
                              </a>
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
          className="bg-white p-5 sm:p-6 rounded-[24px] border border-[rgba(0,0,0,0.05)] shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4 flex flex-col h-[600px] lg:h-[700px] overflow-y-auto custom-scrollbar"
        >
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">画面描述</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={status === 'loading'}
              placeholder="描述您想要生成的视频场景细节，例如：运镜方向、主体动作、光影质感..."
              className="w-full p-3 bg-[#f5f5f7] border border-transparent rounded-[16px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 focus:border-transparent min-h-[100px] resize-y disabled:opacity-50 text-[15px] text-[#1d1d1f] placeholder-[#86868b] transition-all"
            />
          </div>

          <div>
             <div className="flex justify-between items-end mb-1.5">
              <label className="block text-[13px] font-semibold text-[#1d1d1f]">图像转视频源图 (选填)</label>
              <div className="relative">
                <select 
                   value={mode}
                   onChange={(e) => setMode(e.target.value)}
                   disabled={status === 'loading'}
                   className="appearance-none text-[12px] pl-2 pr-7 py-1 border border-[rgba(0,0,0,0.1)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 bg-[#f5f5f7] text-[#1d1d1f] font-medium"
                >
                  <option value="standard">常规 / 图生视频 / 多图转换</option>
                  <option value="keyframes">关键帧动画</option>
                </select>
                <div className="absolute right-2 top-1.5 pointer-events-none text-[#86868b]">
                  <ChevronDown size={14} />
                </div>
              </div>
             </div>
            <textarea
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              disabled={status === 'loading'}
              rows={1}
              placeholder="支持贴入图片URL (多图可换行)"
              className="w-full p-3 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 focus:border-transparent disabled:opacity-50 text-[14px] text-[#1d1d1f] placeholder-[#86868b] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
               <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">常用比例</label>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                 {[
                   { label: '1088x1088 (1:1)', w: 1088, h: 1088 },
                   { label: '1408x1088 (4:3)', w: 1408, h: 1088 },
                   { label: '1088x1408 (3:4)', w: 1088, h: 1408 },
                   { label: '1920x1088 (16:9)', w: 1920, h: 1088 },
                   { label: '1088x1920 (9:16)', w: 1088, h: 1920 },
                   { label: '3840x2176 (4K)', w: 3840, h: 2176 }
                 ].map(t => (
                    <button
                      key={t.w + 'x' + t.h}
                      onClick={(e) => { e.preventDefault(); setWidth(t.w); setHeight(t.h); }}
                      className={cn(
                        "text-[12px] py-2 rounded-[8px] transition-all font-medium border flex items-center justify-center font-mono tracking-tight",
                        width === t.w && height === t.h 
                          ? "bg-[#8c52ff] text-white border-[#8c52ff] shadow-[0_2px_10px_rgba(140,82,255,0.2)]" 
                          : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] border-transparent"
                      )}
                    >
                      {t.label}
                    </button>
                 ))}
               </div>
            </div>
            <div className="relative">
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">帧数</label>
              <select
                value={numFrames}
                onChange={(e) => setNumFrames(Number(e.target.value))}
                disabled={status === 'loading'}
                className="w-full pl-3 pr-8 py-2.5 appearance-none bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
              >
                <option value={81}>81 帧 (较短)</option>
                <option value={121}>121 帧 (默认)</option>
                <option value={161}>161 帧</option>
                <option value={241}>241 帧</option>
                <option value={441}>441 帧 (较长)</option>
              </select>
              <div className="absolute right-2 top-[34px] pointer-events-none text-[#86868b]">
                <ChevronDown size={16} />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">帧率 (FPS)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={frameRate}
                onChange={(e) => setFrameRate(Number(e.target.value))}
                disabled={status === 'loading'}
                className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
              />
            </div>
          </div>

          <div className="mt-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">视频宽度 <span className="font-normal text-[11px] text-[#86868b] ml-1">(32/64的倍数)</span></label>
                <input
                  type="number"
                  step="64"
                  min="256"
                  max="4096"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  disabled={status === 'loading'}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[rgba(0,0,0,0.05)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">视频高度 <span className="font-normal text-[11px] text-[#86868b] ml-1">(32/64的倍数)</span></label>
                <input
                  type="number"
                  step="64"
                  min="256"
                  max="4096"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  disabled={status === 'loading'}
                  className="w-full px-3 py-2.5 bg-[#f5f5f7] border border-[rgba(0,0,0,0.05)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#8c52ff]/30 disabled:opacity-50 text-[14px] text-[#1d1d1f] transition-all"
                />
              </div>
            </div>

            <div className="bg-[#f5f5f7] p-3 rounded-[12px] border border-[rgba(0,0,0,0.05)] flex items-center gap-3 text-[13px] text-[#1d1d1f]">
              <Clock size={16} className="text-[#86868b]" />
              <span>预估生成视频时长: <strong>{estDuration} 秒</strong></span>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !apiKey || status === 'loading'}
              className="w-full py-3 bg-[#8c52ff] text-white rounded-full text-[15px] font-medium shadow-sm hover:bg-[#7236ed] disabled:opacity-50 disabled:hover:bg-[#8c52ff] transition-all flex items-center justify-center gap-2"
            >
            {status === 'loading' ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                正在渲染...
              </>
            ) : (
              <>
                <Video size={18} />
                生成视频
              </>
            )}
          </button>

          {!apiKey && (
             <p className="text-[12px] text-[#ff3b30] text-center font-medium">需要配置 API Key 才能生成视频</p>
          )}
          </div>
        </motion.div>
        )}

        {/* Result & Logs Display */}
        <div className="bg-white rounded-[24px] border border-[rgba(0,0,0,0.05)] p-6 sm:p-8 flex flex-col h-[600px] lg:h-[700px] overflow-hidden relative shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <AnimatePresence mode="wait">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative z-10 w-full h-full">
            {displayStatus === 'idle' && !displayVideo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[#86868b] flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center">
                  <Video size={24} className="opacity-50" />
                </div>
                <p className="text-[15px]">生成的视频将在这边呈现</p>
              </motion.div>
            )}

            {displayStatus === 'loading' && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-[#8c52ff] mb-8">
                <Loader2 size={36} className="animate-spin" />
                <div className="text-center">
                  <p className="text-[15px] font-medium">视频正在云端逐帧渲染...</p>
                  {taskId && <p className="text-[12px] font-mono mt-1 opacity-80 select-text">任务 ID: {taskId}</p>}
                </div>
              </motion.div>
            )}

            {displayStatus === 'error' && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-[#ff3b30] bg-[#ff3b30]/5 p-5 rounded-[16px] max-w-sm text-center mb-8">
                <AlertCircle size={24} className="mx-auto mb-3" />
                <h3 className="font-semibold text-[15px] mb-1">生成遇到了问题</h3>
                <p className="text-[13px] opacity-90">{errorMsg}</p>
              </motion.div>
            )}

            {displayStatus === 'success' && displayVideo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex-col flex items-center justify-center mb-4 relative group">
                {displayTaskId && (
                  <div className="mb-3 px-3 py-1.5 bg-[#8c52ff]/10 text-[#8c52ff] rounded-md text-[12px] font-mono select-text self-start">
                    任务 ID: {displayTaskId}
                  </div>
                )}
                <div className="w-full aspect-video rounded-[16px] overflow-hidden bg-[#e8e8ed] flex items-center justify-center border border-[rgba(0,0,0,0.05)] shadow-[0_8px_32px_rgba(0,0,0,0.08)] relative">
                  <video 
                    src={displayVideo} 
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={displayVideo} 
                      download="agnes-video.mp4" 
                      target="_blank"
                      rel="noreferrer"
                      className="bg-white/90 text-[#1d1d1f] px-4 py-2 rounded-full text-[13px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:scale-105 transition-all backdrop-blur-sm"
                    >
                      存储 .mp4
                    </a>
                  </div>
                </div>
                {displayPrompt && (
                  <div className="mt-6 px-4 py-3 bg-[#f5f5f7] rounded-[12px] w-full text-[13px] text-[#1d1d1f] shadow-sm max-h-[100px] overflow-y-auto break-words custom-scrollbar">
                    {displayPrompt}
                  </div>
                )}
              </motion.div>
            )}
          </div>
          </AnimatePresence>

          {/* Polling Logs */}
          <AnimatePresence>
          {showLogs && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 160, opacity: 1 }} className="shrink-0 bg-[#f5f5f7] rounded-[16px] border border-transparent p-5 font-mono text-[12px] text-[#86868b] overflow-y-auto mt-4 custom-scrollbar">
              {pollLog.map((log, i) => (
                <div key={i} className="mb-1.5 leading-relaxed">{log}</div>
              ))}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
