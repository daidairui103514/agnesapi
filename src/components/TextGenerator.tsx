import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, History, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHistory } from '../hooks/useHistory';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatMessage, ChatHistoryItem } from '../types';

export function TextGenerator({ apiKey }: { apiKey: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const { history, addHistory, removeHistory, setHistory } = useHistory<ChatHistoryItem>('agnes_chat_history');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const initialMessages = [...messages, userMessage];
    setMessages(initialMessages);
    setInput('');
    setIsLoading(true);
    
    // Optimistic save
    const activeChatId = saveCurrentChat(initialMessages);

    try {
      const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
      const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`,
        },
        body: JSON.stringify({
          model: 'agnes-2.0-flash',
          messages: initialMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 报错: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || '请求未返回内容',
      };

      const finalMessages = [...initialMessages, assistantMessage];
      setMessages(finalMessages);
      saveCurrentChat(finalMessages, activeChatId);
      
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
                     <p className="text-[14px] text-[#1d1d1f] truncate font-medium pr-6" title={chat.messages[0]?.content}>
                       {chat.messages[0]?.content || '新对话'}
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
           <div className="text-[13px] font-mono font-medium text-[#86868b] flex items-center gap-1.5 px-3 py-1 bg-[#f5f5f7] rounded-full">
              <Bot size={14} />
              agnes-2.0-flash
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
                        {msg.content}
                      </div>
                   </div>
                );
             })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-transparent [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#86868b] space-y-4">
              <Bot size={48} className="opacity-20 mb-2" />
              <p className="text-[15px] text-[#1d1d1f] font-medium mb-4">开始与 agnes-2.0-flash 的对话</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div id={`msg-${index}`} className="scroll-mt-8" key={`msg-${index}`}>
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className={cn(
                     "flex items-start gap-4 max-w-3xl",
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
                    "py-3 px-5 rounded-[20px] max-w-full overflow-hidden leading-relaxed",
                    msg.role === 'user'
                      ? "bg-[#0071e3] text-white rounded-tr-[4px] shadow-sm ml-auto"
                      : "bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-[4px]"
                  )}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap text-[15px]">{msg.content}</div>
                  ) : (
                    <div className="markdown-body prose prose-sm max-w-none text-[15px] text-[#1d1d1f] prose-p:leading-relaxed">
                      <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                    </div>
                  )}
                </div>
              </motion.div>
              </div>
            ))
          )}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-4 max-w-3xl mr-auto">
              <div className="p-2 rounded-full shrink-0 bg-[#f5f5f7] text-[#1d1d1f] mt-1">
                <Bot size={18} />
              </div>
              <div className="py-3 px-5 rounded-[20px] bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-[4px] flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-[#86868b]" />
                <span className="text-[15px]">正在思考...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-[rgba(0,0,0,0.05)] shrink-0 relative z-10 w-full transition-all">
          <form onSubmit={handleSubmit} className="flex gap-4 max-w-4xl mx-auto items-center relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={apiKey ? "输入您的问题或指令..." : "请先在上方设置中填入 API 密钥"}
              disabled={!apiKey || isLoading}
              className="flex-1 py-3.5 pl-5 pr-14 bg-[#f5f5f7] border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 transition-all disabled:opacity-50 text-[15px] text-[#1d1d1f] placeholder-[#86868b]"
            />
            <button
              type="submit"
              disabled={!input.trim() || !apiKey || isLoading}
              className="absolute right-2 p-2 bg-[#0071e3] text-white rounded-full shadow-sm hover:bg-[#0077ed] disabled:opacity-50 disabled:hover:bg-[#0071e3] transition-all flex items-center justify-center shrink-0"
            >
              <Send size={16} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
