import React, { useState, useEffect } from 'react';
import { Settings, MessageSquare, Image as ImageIcon, Video as VideoIcon, X, User as UserIcon, Bot, Sparkles, CheckCircle2, Lock, Sun, Moon } from 'lucide-react';
import { TextGenerator } from './components/TextGenerator';
import { ImageGenerator } from './components/ImageGenerator';
import { VideoGenerator } from './components/VideoGenerator';
import { cn } from './lib/utils';
import type { ApiSettings } from './types';
import { useCurrentUser } from './hooks/useCurrentUser';

const TABS = [
  { id: 'text', label: 'Chat', icon: MessageSquare, color: 'text-[#0071e3]' },
  { id: 'image', label: 'Image', icon: ImageIcon, color: 'text-[#d95d39]' },
  { id: 'video', label: 'Video', icon: VideoIcon, color: 'text-[#8c52ff]' }
] as const;

export default function App() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('text');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('https://apihub.agnes-ai.com/v1');
  const [userInput, setUserInput] = useState('');
  const [settings, setSettings] = useState<ApiSettings>({ apiKey: '', baseUrl: 'https://apihub.agnes-ai.com/v1' });
  const { user, changeUser } = useCurrentUser();

  // Config & Login
  const [config, setConfig] = useState({ loaded: false, requirePassword: false, hasServerKey: false });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('agnes_api_key') || '';
    const savedBaseUrl = localStorage.getItem('agnes_base_url') || 'https://apihub.agnes-ai.com/v1';
    
    setSettings({ apiKey: savedApiKey, baseUrl: savedBaseUrl });
    setApiKeyInput(savedApiKey);
    setBaseUrlInput(savedBaseUrl);

    fetch('/api/config')
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch config");
        return res.json();
      })
      .then(async data => {
        const hasServerKey = data.hasAgnesKey || data.hasRanmengKey;
        if (data.requirePassword && savedApiKey) {
          try {
            const verifyRes = await fetch('/api/verify-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: savedApiKey })
            });
            const d = await verifyRes.json();
            setConfig({ loaded: true, requirePassword: !d.success, hasServerKey });
          } catch (e) {
            setConfig({ loaded: true, requirePassword: true, hasServerKey });
          }
        } else {
          setConfig({ loaded: true, requirePassword: !!data.requirePassword, hasServerKey });
        }
      })
      .catch((e) => {
        console.error("Config fetch failed:", e);
        // Fallback if the API endpoint isn't working (e.g. static host without functions running properly)
        setConfig({ loaded: true, requirePassword: false, hasServerKey: false });
      });
  }, []);

  const handleSaveSettings = () => {
    const newApiKey = apiKeyInput.trim();
    const newBaseUrl = baseUrlInput;

    setSettings({ apiKey: newApiKey, baseUrl: newBaseUrl });
    localStorage.setItem('agnes_api_key', newApiKey);
    localStorage.setItem('agnes_base_url', newBaseUrl);

    changeUser(userInput);
    setIsSettingsOpen(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword.trim()) return;

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });
      const data = await res.json();

      if (data.success) {
        setSettings(s => ({ ...s, apiKey: loginPassword }));
        setApiKeyInput(loginPassword);
        localStorage.setItem('agnes_api_key', loginPassword);
        setConfig(c => ({ ...c, requirePassword: false }));
      } else {
        setLoginError('密码错误，请重试');
      }
    } catch (e) {
      setLoginError('验证失败，请稍后重试');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!config.loaded) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#86868b] dark:text-[#a1a1a6] animate-pulse">
          <Bot size={32} className="opacity-20" />
        </div>
      </div>
    );
  }

  if (config.requirePassword) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] p-8 shadow-[0_16px_64px_rgba(0,0,0,0.08)] w-full max-w-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-[#0071e3]/10 text-[#0071e3] rounded-full flex items-center justify-center mb-4">
              <Lock size={24} />
            </div>
            <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">需要访问密码</h1>
            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-1 text-center">当前站点已设置密码保护</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="请输入网站密码"
                className="w-full p-3 bg-[#f5f5f7] dark:bg-[#000000] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/50 focus:bg-white dark:bg-[#1c1c1e] text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all text-center tracking-widest"
                autoFocus
              />
              {loginError && <p className="text-[12px] text-[#ff3b30] mt-2 text-center font-medium">{loginError}</p>}
            </div>
            <button
              type="submit"
              disabled={isLoggingIn || !loginPassword.trim()}
              className="w-full py-3 bg-[#0071e3] text-white rounded-full text-[15px] font-medium shadow-sm hover:bg-[#0077ed] disabled:opacity-50 disabled:hover:bg-[#0071e3] transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? '验证中...' : '进入网站'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] font-sans selection:bg-[#0071e3]/30 flex flex-col">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#f5f5f7] dark:bg-[#000000]/80 backdrop-blur-xl border-b border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[52px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <img src="https://cloudflare-imgbed-9h9.pages.dev/file/头像/1765445626829_微信图片_20230406202907.jpg" alt="Logo" className="w-6 h-6 rounded-md object-cover" />
              <span className="font-semibold text-[17px] tracking-tight">Nexus AI</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex space-x-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const labelMap: Record<string, string> = {
                  'Chat': '对话',
                  'Image': '图像',
                  'Video': '视频'
                };
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] transition-all duration-200",
                      isActive 
                        ? `bg-[#e8e8ed] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold` 
                        : `text-[#86868b] dark:text-[#a1a1a6] hover:bg-[#e8e8ed] dark:bg-[#2c2c2e]/50 font-medium`
                    )}
                  >
                    <Icon size={14} className={isActive ? tab.color : 'text-[#86868b] dark:text-[#a1a1a6]'} />
                    <span className="hidden sm:inline">{labelMap[tab.label] || tab.label}</span>
                  </button>
                );
              })}
            </nav>
            
            <div className="w-px h-6 bg-[#d2d2d7] mx-1"></div>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full transition-all flex items-center justify-center text-[#86868b] dark:text-[#a1a1a6] hover:bg-[#e8e8ed] dark:hover:bg-[#2c2c2e]"
              title="切换主题"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              onClick={() => {
                setApiKeyInput(settings.apiKey);
                setBaseUrlInput(settings.baseUrl || 'https://apihub.agnes-ai.com/v1');
                setUserInput(user);
                setIsSettingsOpen(true);
              }}
              className={cn(
                "p-1.5 rounded-full transition-all flex items-center gap-1.5 px-3 text-[13px] font-medium",
                (settings.apiKey || config.hasServerKey)
                  ? "bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#e8e8ed] dark:bg-[#2c2c2e]" 
                  : "bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20"
              )}
              title="设置"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">
                {(settings.apiKey || config.hasServerKey) ? '已连接' : '需配置 API'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {!settings.apiKey && !isSettingsOpen && !config.hasServerKey && (
          <div className="mb-8 p-4 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px]">未配置设置</p>
              <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-1">请在设置中输入 API 密钥以使用完整功能，并设置账号以便同步云端记录。</p>
            </div>
            <button 
              onClick={() => {
                setApiKeyInput(settings.apiKey);
                setBaseUrlInput(settings.baseUrl || 'https://apihub.agnes-ai.com/v1');
                setUserInput(user);
                setIsSettingsOpen(true);
              }}
              className="px-4 py-2 bg-[#0071e3] text-white text-[13px] font-medium rounded-full hover:bg-[#0077ed] transition w-max shrink-0"
            >
              打开设置
            </button>
          </div>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative flex-1">
          <div className={activeTab === 'text' ? 'block h-full' : 'hidden'}><TextGenerator apiKey={settings.apiKey || (config.hasServerKey ? "server_key" : "")} baseUrl={settings.baseUrl} /></div>
          <div className={activeTab === 'image' ? 'block h-full' : 'hidden'}><ImageGenerator apiKey={settings.apiKey || (config.hasServerKey ? "server_key" : "")} baseUrl={settings.baseUrl} /></div>
          <div className={activeTab === 'video' ? 'block h-full' : 'hidden'}><VideoGenerator apiKey={settings.apiKey || (config.hasServerKey ? "server_key" : "")} baseUrl={settings.baseUrl} /></div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#f5f5f7] dark:bg-[#000000]/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] shadow-[0_16px_64px_rgba(0,0,0,0.12)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6">
              <h2 className="text-[19px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">设置</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-[#86868b] dark:text-[#a1a1a6] bg-[#f5f5f7] dark:bg-[#000000] hover:bg-[#e8e8ed] dark:bg-[#2c2c2e] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="px-6 pb-6">
              <div className="space-y-2">
                <label className="block text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Base URL
                </label>
                <div className="relative">
                  <select 
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    className="w-full p-3 bg-[#f5f5f7] dark:bg-[#000000] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/50 focus:bg-white dark:bg-[#1c1c1e] focus:border-[#0071e3]/30 text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all appearance-none pr-10"
                  >
                    <option value="https://apihub.agnes-ai.com/v1">Agnes API (默认)</option>
                    <option value="https://api.ranmeng.icu/v1">Ranmeng API (gpt-5.5)</option>
                  </select>
                  <div className="absolute right-3 top-[14px] pointer-events-none text-[#86868b] dark:text-[#a1a1a6]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                
                <div className="mt-3 bg-[#f5f5f7] dark:bg-[#000000] p-3.5 rounded-[12px] border border-[rgba(0,0,0,0.03)]">
                  <h4 className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2.5 flex items-center gap-1.5 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] pb-2">
                    <Bot size={15} className="text-[#0071e3]" />
                    已选接口支持模型
                  </h4>
                  {baseUrlInput.includes('ranmeng') ? (
                    <ul className="space-y-2 text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-[#34c759]" /> 文本生成: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] ml-0.5">gpt-5.5</strong></li>
                      <li className="flex items-center gap-1.5"><X size={13} className="text-[#ff3b30]" /> 图像生成: <span className="ml-0.5 opacity-80">不支持 (仅限 Agnes API)</span></li>
                      <li className="flex items-center gap-1.5"><X size={13} className="text-[#ff3b30]" /> 视频生成: <span className="ml-0.5 opacity-80">不支持 (仅限 Agnes API)</span></li>
                    </ul>
                  ) : (
                    <ul className="space-y-2 text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-[#0071e3]" /> <span className="w-[52px]">文本生成:</span> <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">agnes-2.0-flash</strong> <span className="text-[10px] bg-[#d2d2d7]/40 px-1.5 py-0.5 rounded ml-1">支持深度思考</span></li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-[#0071e3]" /> <span className="w-[52px]">图像生成:</span> <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">agnes-image-2.1-flash</strong></li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-[#0071e3]" /> <span className="w-[52px]">视频生成:</span> <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">agnes-video-1.0</strong></li>
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-5">
                <label className="block text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  网站密码 / API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full p-3 bg-[#f5f5f7] dark:bg-[#000000] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/50 focus:bg-white dark:bg-[#1c1c1e] focus:border-[#0071e3]/30 font-mono text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] transition-all"
                />
                <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-1 leading-relaxed">
                  您的 API 密钥仅保存在浏览器本地。
                </p>
              </div>

              <div className="space-y-2 mt-5">
                <label className="block text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5">
                  <UserIcon size={14} className="text-[#86868b] dark:text-[#a1a1a6]" />
                  共享账号分配 (选填)
                </label>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="如输入 'allen' 会只查看该名称的历史记录"
                  className="w-full p-3 bg-[#f5f5f7] dark:bg-[#000000] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/50 focus:bg-white dark:bg-[#1c1c1e] focus:border-[#0071e3]/30 text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] transition-all"
                />
                <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-1 leading-relaxed">
                  如果多人共用该部署版本，可以通过填入唯一的相同名称(如微信名) 来隔离自己的云端生成记录。不填默认为 default。
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#f5f5f7] dark:bg-[#000000] flex justify-end gap-2 border-t border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)]">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#e8e8ed] dark:bg-[#2c2c2e] rounded-full transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 text-[13px] font-medium text-white bg-[#0071e3] hover:bg-[#0077ed] rounded-full shadow-sm transition"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
