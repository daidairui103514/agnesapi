import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, History, Plus, X, Image as ImageIcon, Brain, Settings2, RotateCw, Undo2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHistory } from '../hooks/useHistory';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatMessage, ChatHistoryItem } from '../types';

export function TextGenerator({ apiKey, baseUrl }: { apiKey: string, baseUrl?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [enableThinking, setEnableThinking] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showPersona, setShowPersona] = useState(false);
  
  const { history, addHistory, removeHistory, setHistory } = useHistory<ChatHistoryItem>('agnes_chat_history');
  
  const targetBaseUrl = baseUrl || 'https://apihub.agnes-ai.com/v1';
  const displayModel = targetBaseUrl.includes('ranmeng') ? 'gpt-5.5' : 'agnes-2.0-flash';
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (instant?: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom(isLoading);
  }, [messages, isLoading]);

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
  };

  const loadChat = (chat: ChatHistoryItem) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
  };

  const saveCurrentChat = (newMessages: ChatMessage[], explicitChatId?: string): string => {
    let chatId = explicitChatId || currentChatId;
    if (!chatId) {
       chatId = uuidv4();
       setCurrentChatId(chatId);
    }
    
    setHistory(prev => {
       const existing = prev.filter((c: any) => c.id !== chatId);
       return [{
         id: chatId,
         messages: newMessages,
         timestamp: Date.now()
       }, ...existing].slice(0, 50);
    });
    return chatId as string;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  const runCompletion = async (initialMessages: ChatMessage[], activeChatId: string) => {
    setIsLoading(true);
    try {
      const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
      const messagesPayload = systemPrompt.trim() 
         ? [{ role: 'system', content: systemPrompt }, ...initialMessages] 
         : initialMessages;
         
      const targetBaseUrl = baseUrl || 'https://apihub.agnes-ai.com/v1';
      const targetModel = targetBaseUrl.includes('ranmeng') ? 'gpt-5.5' : 'agnes-2.0-flash';
         
      const response = await fetch(`/api/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`,
          'x-target-url': `${targetBaseUrl}/chat/completions`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: messagesPayload,
          stream: true,
          chat_template_kwargs: {
            enable_thinking: enableThinking
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`API 报错: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader from response');
      const decoder = new TextDecoder('utf-8');

      let assistantMessageContent = '';
      
      setMessages((prev) => [
         ...prev,
         { role: 'assistant', content: '' }
      ]);
      
      let isFirstChunk = true;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';
        
        for (const line of lines) {
           if (line.trim().startsWith('data: ') && !line.includes('[DONE]')) {
             try {
               const parsed = JSON.parse(line.trim().slice(6));
               
               if (parsed.choices?.[0]?.delta?.content) {
                 assistantMessageContent += parsed.choices[0].delta.content;
                 
                 setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantMessageContent;
                    return newMessages;
                 });
                 
                 if (isFirstChunk) {
                    scrollToBottom(true);
                    isFirstChunk = false;
                 }
               }
             } catch (e) {
               console.error('Json parse error on chunk:', e);
             }
           }
        }
      }

      setMessages((prev) => {
         saveCurrentChat(prev, activeChatId);
         return prev;
      });
      
    } catch (error: any) {
      setMessages((prev) => {
        const errorMessages = [...prev, { role: 'assistant', content: `**抱歉，发生错误:** ${error.message}` }];
        saveCurrentChat(errorMessages as unknown as ChatMessage[], activeChatId);
        return errorMessages as any;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    const content = imageUrl ? [
      { type: 'text', text: input.trim() },
      { type: 'image_url', image_url: { url: imageUrl.trim() } }
    ] : input.trim();
    
    const userMessage: ChatMessage = { role: 'user', content };
    const initialMessages = [...messages, userMessage];
    setMessages(initialMessages);
    setInput('');
    setImageUrl('');
    
    const activeChatId = saveCurrentChat(initialMessages);
    await runCompletion(initialMessages, activeChatId);
  };

  const handleDeleteMessage = (index: number) => {
    const newMessages = [...messages];
    newMessages.splice(index, 1);
    setMessages(newMessages);
    saveCurrentChat(newMessages);
  };

  const handleWithdraw = (index: number) => {
    let userMsg = null;
    let spliceIndex = index;
    for (let i = index; i >= 0; i--) {
       if (messages[i].role === 'user') {
          userMsg = messages[i];
          spliceIndex = i;
          break;
       }
    }
    if (userMsg) {
       const content = typeof userMsg.content === 'string' ? userMsg.content : userMsg.content.find((p:any)=>p.type==='text')?.text || '';
       setInput(content);
       const newMessages = messages.slice(0, spliceIndex);
       setMessages(newMessages);
       saveCurrentChat(newMessages);
    }
  };

  const handleRegenerate = async (index: number) => {
    const prevMessages = messages.slice(0, index);
    setMessages(prevMessages);
    const activeChatId = saveCurrentChat(prevMessages);
    await runCompletion(prevMessages, activeChatId);
  };


  return (
    <div className="flex h-[calc(100vh-140px)] max-h-[800px] border border-[rgba(0,0,0,0.05)] rounded-[20px] overflow-hidden bg-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div 
             initial={{ width: 0, opacity: 0 }}
             animate={{ width: 280, opacity: 1 }}
             exit={{ width: 0, opacity: 0 }}
             className="border-r border-[rgba(0,0,0,0.05)] bg-[#f5f5f7] flex flex-col shrink-0 overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between">
              <button 
                onClick={startNewChat}
                className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] hover:bg-white hover:shadow-sm px-4 py-2.5 rounded-full w-full transition-all border border-transparent hover:border-[rgba(0,0,0,0.05)]"
              >
                <Plus size={16} />
                新建对话
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
               {history.length === 0 ? (
                 <div className="px-4 py-8 text-center text-[13px] text-[#86868b]">
                    暂无对话记录
                 </div>
               ) : (
                 history.map(chat => (
                   <div 
                      key={chat.id} 
                      className={cn(
                        "group flex flex-col p-3 rounded-2xl cursor-pointer transition-all border max-w-full relative",
                        currentChatId === chat.id 
                           ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-[rgba(0,0,0,0.05)]" 
                           : "bg-transparent border-transparent hover:bg-[rgba(0,0,0,0.04)]"
                      )}
                      onClick={() => loadChat(chat)}
                   >
                     <p className="text-[14px] text-[#1d1d1f] truncate font-medium pr-6" title={typeof chat.messages[0]?.content === 'string' ? chat.messages[0]?.content : '图片对话'}>
                       {typeof chat.messages[0]?.content === 'string' ? chat.messages[0]?.content : '图片对话'}
                     </p>
                     <p className="text-[12px] text-[#86868b] mt-1">
                       {new Date(chat.timestamp).toLocaleDateString()} {new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </p>
                     <button
                        onClick={(e) => { e.stopPropagation(); removeHistory(chat.id); if (currentChatId === chat.id) startNewChat(); }}
                        className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1.5 text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full transition-colors"
                     >
                       <X size={14} />
                     </button>
                   </div>
                 ))
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        <div className="flex justify-between items-center px-4 py-3 bg-white/80 backdrop-blur-xl z-20 shrink-0 border-b border-[rgba(0,0,0,0.05)]">
           <button 
             onClick={() => setShowSidebar(!showSidebar)}
             className="text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] p-2 rounded-full transition"
           >
             <History size={20} />
           </button>
           <button 
             onClick={() => setShowPersona(!showPersona)}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition ${showPersona ? 'bg-[#0071e3]/10 text-[#0071e3]' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}
           >
             <Settings2 size={16} />
             系统人设
           </button>
           <div className="text-[13px] font-mono font-medium text-[#86868b] flex items-center gap-1.5 px-3 py-1 bg-[#f5f5f7] rounded-full">
              <Bot size={14} />
              {displayModel}
           </div>
        </div>

        {/* Dot Timeline for User Messages */}
        {messages.filter(m => m.role === 'user').length > 0 && (
          <div className="absolute right-3 top-[80px] bottom-[80px] w-8 flex flex-col items-center justify-center gap-3 z-30 pointer-events-none">
             {messages.map((msg, idx) => {
                if (msg.role !== 'user') return null;
                return (
                   <div key={`dot-${idx}`} className="relative group pointer-events-auto">
                      <button 
                        onClick={() => document.getElementById(`msg-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        className="w-2 h-2 rounded-full bg-[#0071e3]/30 hover:bg-[#0071e3] transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none bg-white text-[#1d1d1f] border border-[rgba(0,0,0,0.05)] shadow-[0_4px_12px_rgba(0,0,0,0.08)] text-[12px] px-2.5 py-1.5 rounded-[8px] whitespace-nowrap translate-x-2 group-hover:translate-x-0 transition-all max-w-[200px] truncate font-medium">
                        {typeof msg.content === 'string' ? msg.content : (msg.content.find((p: any) => p.type === 'text')?.text || '图片')}
                      </div>
                   </div>
                );
             })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-transparent [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="max-w-4xl mx-auto w-full pb-8 flex flex-col space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center pt-[20vh] text-[#86868b] space-y-4">
                <Bot size={48} className="opacity-20 mb-2" />
                <p className="text-[15px] text-[#1d1d1f] font-medium mb-4">开始与 {displayModel} 的对话</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div id={`msg-${index}`} className="scroll-mt-8 group flex flex-col pt-2" key={`msg-${index}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex items-start gap-4 max-w-full",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                  <div
                    className={cn(
                      "p-2 rounded-full shrink-0 mt-1",
                      msg.role === 'user' ? "text-[#0071e3] bg-[#0071e3]/10 hidden sm:block" : "text-[#1d1d1f] bg-[#f5f5f7]"
                    )}
                  >
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div
                    className={cn(
                      "py-3 px-5 rounded-[20px] max-w-[85%] overflow-hidden leading-relaxed relative",
                      msg.role === 'user'
                        ? "bg-[#0071e3] text-white rounded-tr-[4px] shadow-sm ml-auto"
                        : "bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-[4px]"
                    )}
                  >
                    {msg.role === 'user' ? (
                      <div className="text-[15px]">
                        {typeof msg.content === 'string' ? (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="whitespace-pre-wrap">{msg.content.find((p: any) => p.type === 'text')?.text}</div>
                            {msg.content.find((p: any) => p.type === 'image_url') && (
                              <img src={msg.content.find((p: any) => p.type === 'image_url')?.image_url?.url} alt="User Upload" className="max-w-full max-h-[300px] rounded-[12px] object-contain shadow-sm border border-[rgba(255,255,255,0.2)] mt-1 bg-white/10" />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="markdown-body prose prose-sm max-w-none text-[15px] text-[#1d1d1f] prose-p:leading-relaxed">
                        {isLoading && msg.content === '' && index === messages.length - 1 ? (
                           <div className="flex items-center gap-2 text-[#86868b] min-h-[24px]">
                             <Loader2 size={16} className="animate-spin" />
                             <span className="text-[14px]">正在思考...</span>
                           </div>
                        ) : (
                           <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
                
                {/* Message Actions */}
                {!isLoading && (
                  <div className={cn(
                    "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1",
                    msg.role === 'user' ? "self-end pr-[52px] sm:pr-[60px]" : "self-start pl-[52px] sm:pl-[60px]"
                  )}>
                    {msg.role === 'user' ? (
                      <button onClick={() => handleWithdraw(index)} className="group/action relative p-1.5 hover:bg-[#f5f5f7] rounded-[6px] text-[#86868b] hover:text-[#1d1d1f] transition">
                         <Undo2 size={14} />
                         <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-[#1d1d1f] text-white text-[12px] font-medium rounded-[6px] opacity-0 group-hover/action:opacity-100 transition-all duration-200 -translate-y-1 group-hover/action:translate-y-0 whitespace-nowrap pointer-events-none shadow-sm z-50">
                            撤回重写
                            <div className="absolute -top-[8px] left-1/2 -translate-x-1/2 border-[4px] border-transparent border-b-[#1d1d1f]"></div>
                         </div>
                      </button>
                    ) : (
                      <button onClick={() => handleRegenerate(index)} className="group/action relative p-1.5 hover:bg-[#f5f5f7] rounded-[6px] text-[#86868b] hover:text-[#1d1d1f] transition">
                         <RotateCw size={14} />
                         <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-[#1d1d1f] text-white text-[12px] font-medium rounded-[6px] opacity-0 group-hover/action:opacity-100 transition-all duration-200 -translate-y-1 group-hover/action:translate-y-0 whitespace-nowrap pointer-events-none shadow-sm z-50">
                            重新生成
                            <div className="absolute -top-[8px] left-1/2 -translate-x-1/2 border-[4px] border-transparent border-b-[#1d1d1f]"></div>
                         </div>
                      </button>
                    )}
                    <button onClick={() => handleDeleteMessage(index)} className="group/action relative p-1.5 hover:bg-[#ff3b30]/10 rounded-[6px] text-[#86868b] hover:text-[#ff3b30] transition">
                       <Trash2 size={14} />
                       <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-[#ff3b30] text-white text-[12px] font-medium rounded-[6px] opacity-0 group-hover/action:opacity-100 transition-all duration-200 -translate-y-1 group-hover/action:translate-y-0 whitespace-nowrap pointer-events-none shadow-sm z-50">
                          删除记录
                          <div className="absolute -top-[8px] left-1/2 -translate-x-1/2 border-[4px] border-transparent border-b-[#ff3b30]"></div>
                       </div>
                    </button>
                  </div>
                )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Persona Settings Overlay */}
        <AnimatePresence>
          {showPersona && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-[60px] left-0 right-0 z-20 px-4 flex justify-center"
            >
              <div className="bg-white/95 backdrop-blur-xl text-[#1d1d1f] w-full max-w-2xl rounded-[16px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-[rgba(0,0,0,0.08)] p-4 pt-3 relative top-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[14px] font-medium text-[#1d1d1f]">
                    <Settings2 size={16} className="text-[#0071e3]" />
                    系统人设
                  </div>
                  <button onClick={() => setShowPersona(false)} className="p-1 hover:bg-[#f5f5f7] rounded-full transition text-[#86868b] hover:text-[#1d1d1f]">
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="例如：你是一个话很多，又特别粘人的恋人..."
                  rows={4}
                  className="w-full bg-[#f5f5f7] text-[#1d1d1f] border border-[rgba(0,0,0,0.05)] rounded-[12px] p-3 text-[14px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:bg-white transition-all placeholder:text-[#86868b] resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button 
                    onClick={() => setShowPersona(false)}
                    className="px-4 py-1.5 bg-[#0071e3] text-white text-[13px] font-medium rounded-full hover:bg-[#0077ed] transition-colors"
                  >
                    保存并应用
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-4 bg-white border-t border-[rgba(0,0,0,0.05)] shrink-0 relative z-10 w-full transition-all">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-4xl mx-auto relative">
            {imageUrl && imageUrl.startsWith('data:') && (
              <div className="relative inline-block w-fit">
                <img src={imageUrl} alt="Upload Preview" className="h-16 rounded-[8px] object-cover border border-[rgba(0,0,0,0.1)]" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute -top-2 -right-2 p-1 bg-white border border-[rgba(0,0,0,0.1)] text-[#1d1d1f] rounded-full shadow-sm hover:bg-[#f5f5f7] transition-all z-10"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {(!imageUrl || !imageUrl.startsWith('data:')) && (
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="可选: 贴入公网图片 URL 支持图片理解..."
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 transition-all disabled:opacity-50 text-[13px] text-[#1d1d1f] placeholder-[#86868b]"
              />
            )}
            <div className="relative flex items-center bg-[#f5f5f7] rounded-full focus-within:ring-2 focus-within:ring-[#0071e3]/30 transition-all border border-transparent">
              <label 
                htmlFor="chat-image-upload" 
                className={`group relative pl-4 pr-1.5 hover:text-[#0071e3] transition-colors cursor-pointer flex items-center justify-center py-2 ${isLoading ? 'text-[#86868b]/50 cursor-not-allowed' : 'text-[#86868b]'}`}
              >
                <ImageIcon size={20} />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-[#1d1d1f] text-white text-[12px] font-medium rounded-[6px] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 whitespace-nowrap pointer-events-none shadow-sm z-50">
                  作为参考图片
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-[#1d1d1f]"></div>
                </div>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isLoading}
                className="hidden"
                id="chat-image-upload"
              />
              <button
                type="button"
                onClick={() => setEnableThinking(!enableThinking)}
                className={`group relative px-1.5 py-2 flex items-center justify-center transition-colors ${enableThinking ? 'text-[#0071e3]' : 'text-[#86868b] hover:text-[#0071e3]'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading}
              >
                <Brain size={20} />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-[#1d1d1f] text-white text-[12px] font-medium rounded-[6px] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 whitespace-nowrap pointer-events-none shadow-sm z-50">
                  {enableThinking ? "关闭深度思考" : "开启深度思考"}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-[#1d1d1f]"></div>
                </div>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入您的问题或指令..."
                disabled={isLoading}
                className="flex-1 py-3.5 pl-2 pr-14 bg-transparent border-none focus:outline-none disabled:opacity-50 text-[15px] text-[#1d1d1f] placeholder-[#86868b]"
              />
              <button
                type="submit"
                disabled={!input.trim() || !apiKey || isLoading}
                className="group absolute right-2 p-2 bg-[#0071e3] text-white rounded-full shadow-sm hover:bg-[#0077ed] disabled:opacity-50 disabled:hover:bg-[#0071e3] transition-all flex items-center justify-center shrink-0"
              >
                <Send size={16} className="ml-0.5" />
                {!apiKey && (
                  <div className="absolute -top-10 right-0 px-2.5 py-1.5 bg-[#ff3b30] text-white text-[12px] font-medium rounded-[6px] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 whitespace-nowrap pointer-events-none shadow-sm z-50">
                    请先填入 API 密钥
                    <div className="absolute -bottom-1 right-3 border-[4px] border-transparent border-t-[#ff3b30]"></div>
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
