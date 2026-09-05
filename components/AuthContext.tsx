import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

export interface AdminUser {
  username: string;
  role: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  daysRemaining: number | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const STORAGE_KEY = 'ceaznet_admin_jwt';

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  daysRemaining: null,
  login: async () => ({ success: false }),
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Verify JWT session on initial application load
  useEffect(() => {
    let isMounted = true;

    async function verifyExistingSession() {
      const storedToken = localStorage.getItem(STORAGE_KEY);
      
      if (!storedToken) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
          },
          body: JSON.stringify({ token: storedToken })
        });

        const data = await res.json().catch(() => ({}));

        if (isMounted) {
          if (res.ok && data.success && data.valid) {
            setIsAuthenticated(true);
            setUser(data.user || { username: 'admin', role: 'admin' });
            setDaysRemaining(data.daysRemaining ?? 7);
          } else {
            // Token expired or invalid
            localStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem('ceaznet-admin-auth');
            setIsAuthenticated(false);
            setUser(null);
            setDaysRemaining(null);
            if (data.message && !data.message.includes('No authorization')) {
              toast.error(data.message || 'Session expired. Please log in again.');
            }
          }
        }
      } catch (err) {
        console.warn('Session verification network error, keeping optimistic token if valid:', err);
        // If network error occurs during verification, we can retry or gracefully prompt
        if (isMounted) {
          // Keep unauthenticated if server unreachable for security
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    verifyExistingSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (usernameInput: string, passwordInput: string) => {
    const trimmedUser = usernameInput.trim();
    const trimmedPass = passwordInput.trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, message: 'Please enter both username and password.' };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: trimmedUser,
          password: trimmedPass
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.token) {
        localStorage.setItem(STORAGE_KEY, data.token);
        sessionStorage.setItem('ceaznet-admin-auth', 'true');
        setIsAuthenticated(true);
        setUser(data.user || { username: trimmedUser, role: 'admin' });
        setDaysRemaining(7);
        toast.success('Authenticated successfully. Session valid for 7 days.');
        return { success: true };
      }

      return {
        success: false,
        message: data.message || 'Incorrect username or password. Access denied.'
      };
    } catch (err: any) {
      console.error('Login request error:', err);
      return {
        success: false,
        message: `Server connection failed: ${err.message || 'Unknown network error'}`
      };
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('ceaznet-admin-auth');
    setIsAuthenticated(false);
    setUser(null);
    setDaysRemaining(null);
    toast.success('Logged out successfully.');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        daysRemaining,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
