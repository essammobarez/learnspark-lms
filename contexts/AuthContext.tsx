
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { mockApiService } from '../services/mockApiService';
import { MOCK_USERS } from '../constants';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password_unused: string) => Promise<boolean>;
  logout: () => void;
  setUserRoleForDev: (role: UserRole) => void; // For easy role switching in dev
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Try to load user from localStorage (simulating session persistence)
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password_unused: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const foundUser = await mockApiService.login(email, password_unused);
      if (foundUser) {
        setUser(foundUser);
        localStorage.setItem('currentUser', JSON.stringify(foundUser));
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };
  
  // Helper for development to quickly switch roles without full login
  const setUserRoleForDev = (role: UserRole) => {
    const devUser = MOCK_USERS.find(u => u.role === role);
    if (devUser) {
      setUser(devUser);
      localStorage.setItem('currentUser', JSON.stringify(devUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, setUserRoleForDev }}>
      {children}
    </AuthContext.Provider>
  );
};
