
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole } from '../types';
import { apiService } from '../services/apiService'; 

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password_unused: string) => Promise<boolean>;
  signup: (username: string, email: string, password_unused: string, role: UserRole) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>; 
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (currentToken) {
      setToken(currentToken); 
      try {
        setIsLoading(true);
        const fetchedUser = await apiService.getCurrentUser(); // This should return User with numeric ID
        setUser(fetchedUser);
      } catch (error) {
        console.error("Session restore failed:", error);
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
      } finally {
        setIsLoading(false);
      }
    } else {
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password_unused: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { token: newAuthToken, user: loggedInUser } = await apiService.login(email, password_unused); // loggedInUser has numeric ID
      localStorage.setItem('authToken', newAuthToken);
      setToken(newAuthToken);
      setUser(loggedInUser);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
      return false;
    }
  };

  const signup = async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      // apiService.signup should return a user object with numeric ID if successful, or just success/message
      const result = await apiService.signup(username, email, password_unused, role);
      setIsLoading(false);
      // If signup implies login, might need to call fetchCurrentUser or set user from result.user
      // For now, it just returns success/message. Login is separate.
      return result; 
    } catch (error) {
      console.error("Signup failed:", error);
      setIsLoading(false);
      return { success: false, message: error instanceof Error ? error.message : 'An unknown error occurred during signup.' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    // Optionally, could call an API endpoint to invalidate token on backend
  };
  
  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, signup, logout, fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
