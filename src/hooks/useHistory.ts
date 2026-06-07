import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';

export function useHistory<T extends { id: string, timestamp?: number }>(key: string) {
  const [history, setHistoryState] = useState<T[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const typeMap = {
    'agnes_video_history': 'video',
    'agnes_image_history': 'image',
    'agnes_chat_history': 'chat'
  };
  const type = typeMap[key as keyof typeof typeMap] || 'unknown';

  useEffect(() => {
    let mounted = true;
    
    const loadAndMigrate = async () => {
      try {
        // Fetch from backend
        const res = await fetch(`/api/history?type=${type}`);
        let dbData: T[] = [];
        if (res.ok) {
          dbData = await res.json();
        }

        // Get local data
        const localData = await localforage.getItem<T[]>(key);
        
        if (mounted) {
          // If local data exists and DB is empty, sync it up!
          if (localData && localData.length > 0 && dbData.length === 0) {
             setHistoryState(localData);
             setIsLoaded(true);
             
             // Sync local to remote
             try {
               await fetch('/api/history/sync', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ type, items: localData })
               });
               // Clear localforage after successful sync? No, keep it as backup or clear it?
               // Wait, don't clear it yet to be safe, just sync.
             } catch(e) {
               console.error('Failed to sync to DB', e);
             }
          } else {
             // Let DB take precedence
             setHistoryState(dbData);
             setIsLoaded(true);
             
             // Optionally sync any local items not in DB, but simple overwrite is easier for now.
             if (dbData.length > 0 && localData) {
                // we can clear localforage to avoid old data lingering
                await localforage.removeItem(key);
             }
          }
        }
      } catch (err) {
        console.error('Failed to load history from DB, falling back to local storage', err);
        const localData = await localforage.getItem<T[]>(key);
        if (mounted) {
          if (localData && Array.isArray(localData)) {
            setHistoryState(localData);
          }
          setIsLoaded(true);
        }
      }
    };

    loadAndMigrate();
    return () => { mounted = false; };
  }, [key, type]);

  const setHistory = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setHistoryState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localforage.setItem(key, next).catch(e => console.error('Failed to save history', e));
      // No bulk update logic hooked up for raw setHistory to DB yet, sync endpoints assume adding.
      return next;
    });
  }, [key]);

  const addHistory = useCallback(async (item: T) => {
    setHistoryState((prev) => {
      const next = [item, ...prev].slice(0, 50);
      localforage.setItem(key, next).catch(e => console.error('Failed to save loc history', e));
      return next;
    });
    
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, item })
      });
    } catch (e) {
      console.error('Failed to save DB history', e);
    }
  }, [key, type]);

  const clearHistory = useCallback(() => {
    // Only local clear implemented for blanket clear, UI usually doesn't have an 'erase all' right now
    setHistoryState([]);
    localforage.removeItem(key);
  }, [key]);

  const removeHistory = useCallback(async (id: string) => {
    setHistoryState((prev) => {
      const next = prev.filter((item: any) => item.id !== id);
      localforage.setItem(key, next).catch(e => console.error('Failed to save loc history', e));
      return next;
    });
    
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete from DB', e);
    }
  }, [key]);

  return { history, addHistory, clearHistory, removeHistory, setHistory, isLoaded };
}
