import React, { useState } from 'react';
import { Settings, MessageSquare, Image as ImageIcon, Video as VideoIcon, X, User as UserIcon } from 'lucide-react';
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
  const [userInput, setUserInput] = useState('');
  const [settings, setSettings] = useState<ApiSettings>({ apiKey: '' });
  const { user, changeUser } = useCurrentUser();

  const handleSaveSettings = () => {
    setSettings({ apiKey: apiKeyInput.trim() });
    changeUser(userInput);
    setIsSettingsOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans selection:bg-[#0071e3]/30 flex flex-col">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#f5f5f7]/80 backdrop-blur-xl border-b border-[rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[52px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <span className="font-semibold text-[17px] tracking-tight">Agnes Studio</span>
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
                        ? `bg-[#e8e8ed] text-[#1d1d1f] font-semibold` 
                        : `text-[#86868b] hover:bg-[#e8e8ed]/50 font-medium`
                    )}
                  >
                    <Icon size={14} className={isActive ? tab.color : 'text-[#86868b]'} />
                    <span className="hidden sm:inline">{labelMap[tab.label] || tab.label}</span>
                  </button>
                );
              })}
            </nav>
            
            <div className="w-px h-6 bg-[#d2d2d7] mx-1"></div>

            <button
              onClick={() => {
                setApiKeyInput(settings.apiKey);
                setUserInput(user);
                setIsSettingsOpen(true);
              }}
              className={cn(
                "p-1.5 rounded-full transition-all flex items-center gap-1.5 px-3 text-[13px] font-medium",
                settings.apiKey 
                  ? "bg-transparent text-[#1d1d1f] hover:bg-[#e8e8ed]" 
                  : "bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20"
              )}
              title="设置"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">
                {settings.apiKey ? '已连接' : '需配置 API'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {!settings.apiKey && !isSettingsOpen && (
          <div className="mb-8 p-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.05)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[#1d1d1f] text-[15px]">未配置设置</p>
              <p className="text-[13px] text-[#86868b] mt-1">请在设置中输入 API 密钥以使用完整功能，并设置账号以便同步云端记录。</p>
            </div>
            <button 
              onClick={() => {
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
          <div className={activeTab === 'text' ? 'block h-full' : 'hidden'}><TextGenerator apiKey={settings.apiKey} /></div>
          <div className={activeTab === 'image' ? 'block h-full' : 'hidden'}><ImageGenerator apiKey={settings.apiKey} /></div>
          <div className={activeTab === 'video' ? 'block h-full' : 'hidden'}><VideoGenerator apiKey={settings.apiKey} /></div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#f5f5f7]/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-[0_16px_64px_rgba(0,0,0,0.12)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6">
              <h2 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight">设置</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-[#86868b] bg-[#f5f5f7] hover:bg-[#e8e8ed] hover:text-[#1d1d1f] rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="px-6 pb-6">
              <div className="space-y-2">
                <label className="block text-[13px] font-medium text-[#1d1d1f]">
                  Agnes API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full p-3 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/50 focus:bg-white focus:border-[#0071e3]/30 font-mono text-[14px] text-[#1d1d1f] placeholder-[#86868b] transition-all"
                />
                <p className="text-[11px] text-[#86868b] mt-1 leading-relaxed">
                  您的 API 密钥仅保存在浏览器本地。
                </p>
              </div>

              <div className="space-y-2 mt-5">
                <label className="block text-[13px] font-medium text-[#1d1d1f] flex items-center gap-1.5">
                  <UserIcon size={14} className="text-[#86868b]" />
                  共享账号分配 (选填)
                </label>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="如输入 'allen' 会只查看该名称的历史记录"
                  className="w-full p-3 bg-[#f5f5f7] border border-transparent rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/50 focus:bg-white focus:border-[#0071e3]/30 text-[14px] text-[#1d1d1f] placeholder-[#86868b] transition-all"
                />
                <p className="text-[11px] text-[#86868b] mt-1 leading-relaxed">
                  如果多人共用该部署版本，可以通过填入唯一的相同名称(如微信名) 来隔离自己的云端生成记录。不填默认为 default。
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#f5f5f7] flex justify-end gap-2 border-t border-[rgba(0,0,0,0.05)]">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] rounded-full transition"
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
