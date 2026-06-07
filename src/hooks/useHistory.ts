import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { useCurrentUser } from './useCurrentUser';

export function useHistory<T extends { id: string, timestamp?: number }>(key: string) {
  const [history, setHistoryState] = useState<T[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useCurrentUser();
  
  const typeMap = {
    'agnes_video_history': 'video',
    'agnes_image_history': 'image',
    'agnes_chat_history': 'chat'
  };
  const type = typeMap[key as keyof typeof typeMap] || 'unknown';
  
  // Create a user-scoped local key 
  const localKey = `${key}_${user}`;

  useEffect(() => {
    let mounted = true;
    setIsLoaded(false); // Reset load state when user changes
    
    const loadAndMigrate = async () => {
      try {
        // Fetch from backend
        const res = await fetch(`/api/history?type=${type}&user=${encodeURIComponent(user)}`);
        let dbData: T[] = [];
        if (res.ok) {
          dbData = await res.json();
        }

        // Get local data
        const localData = await localforage.getItem<T[]>(localKey);
        
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
                 body: JSON.stringify({ type, items: localData, user })
               });
             } catch(e) {
               console.error('Failed to sync to DB', e);
             }
          } else {
             // Let DB take precedence
             setHistoryState(dbData);
             setIsLoaded(true);
             
             if (dbData.length > 0 && localData) {
                await localforage.removeItem(localKey);
             }
          }
        }
      } catch (err) {
        console.error('Failed to load history from DB, falling back to local storage', err);
        const localData = await localforage.getItem<T[]>(localKey);
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
  }, [key, type, user, localKey]);

  const setHistory = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setHistoryState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localforage.setItem(localKey, next).catch(e => console.error('Failed to save history', e));
      return next;
    });
  }, [localKey]);

  const addHistory = useCallback(async (item: T) => {
    setHistoryState((prev) => {
      const next = [item, ...prev].slice(0, 50);
      localforage.setItem(localKey, next).catch(e => console.error('Failed to save loc history', e));
      return next;
    });
    
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, item, user })
      });
    } catch (e) {
      console.error('Failed to save DB history', e);
    }
  }, [type, user, localKey]);

  const clearHistory = useCallback(() => {
    setHistoryState([]);
    localforage.removeItem(localKey);
  }, [localKey]);

  const removeHistory = useCallback(async (id: string) => {
    setHistoryState((prev) => {
      const next = prev.filter((item: any) => item.id !== id);
      localforage.setItem(localKey, next).catch(e => console.error('Failed to save loc history', e));
      return next;
    });
    
    try {
      await fetch(`/api/history/${id}?user=${encodeURIComponent(user)}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete from DB', e);
    }
  }, [user, localKey]);

  return { history, addHistory, clearHistory, removeHistory, setHistory, isLoaded };
}
