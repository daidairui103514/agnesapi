import { useState, useEffect } from 'react';

export function useCurrentUser() {
  const [user, setUser] = useState(() => {
    return localStorage.getItem('agnes_current_user') || 'default';
  });

  useEffect(() => {
    const handleUserChange = () => {
      setUser(localStorage.getItem('agnes_current_user') || 'default');
    };

    window.addEventListener('agnes_user_changed', handleUserChange);
    return () => window.removeEventListener('agnes_user_changed', handleUserChange);
  }, []);

  const changeUser = (newUser: string) => {
    const cleanUser = newUser.trim() || 'default';
    setUser(cleanUser);
    localStorage.setItem('agnes_current_user', cleanUser);
    window.dispatchEvent(new Event('agnes_user_changed'));
  };

  return { user, changeUser };
}
