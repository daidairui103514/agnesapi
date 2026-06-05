import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';

export function useHistory<T>(key: string) {
  const [history, setHistoryState] = useState<T[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    localforage.getItem<T[]>(key).then((saved) => {
      if (mounted) {
        if (saved && Array.isArray(saved)) {
          setHistoryState(saved);
        }
        setIsLoaded(true);
      }
    }).catch(e => {
      console.error('Failed to load history', e);
      if (mounted) setIsLoaded(true);
    });
    return () => { mounted = false; };
  }, [key]);

  const setHistory = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setHistoryState((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localforage.setItem(key, next).catch(e => console.error('Failed to save history', e));
      return next;
    });
  }, [key]);

  const addHistory = useCallback((item: T) => {
    setHistoryState((prev) => {
      const next = [item, ...prev].slice(0, 50);
      localforage.setItem(key, next).catch(e => console.error('Failed to save history', e));
      return next;
    });
  }, [key]);

  const clearHistory = useCallback(() => {
    setHistoryState([]);
    localforage.removeItem(key);
  }, [key]);

  const removeHistory = useCallback((id: string) => {
    setHistoryState((prev) => {
      const next = prev.filter((item: any) => item.id !== id);
      localforage.setItem(key, next).catch(e => console.error('Failed to save history', e));
      return next;
    });
  }, [key]);

  return { history, addHistory, clearHistory, removeHistory, setHistory, isLoaded };
}
