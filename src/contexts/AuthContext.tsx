
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole } from '../../types';
import { apiService, supabase } from '../services/apiService'; // Import supabase client directly for onAuthStateChange
import { AuthSession as SupabaseSession, AuthUser as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AuthChangeEvent } from '@supabase/gotrue-js';


interface AuthContextType {
  user: User | null;
  session: SupabaseSession | null; // Store Supabase session
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password_unused: string) => Promise<boolean>;
  signup: (username: string, email: string, password_unused: string, role: UserRole) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>; // To manually re-fetch if needed
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to map Supabase user to application's User type
const mapSupabaseUserToAppUserLocal = (supabaseUser: SupabaseAuthUser | null): User | null => {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    username: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || 'Guest User',
    role: supabaseUser.user_metadata?.role || UserRole.STUDENT, // Default to student if not set
    // enrolledCourseIds and createdCourseIds are not directly on Supabase user object,
    // they would be fetched via apiService if needed directly on the User object in context
  };
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const processUserSession = useCallback(async (currentSession: SupabaseSession | null) => {
    if (currentSession?.user) {
      const appUser = mapSupabaseUserToAppUserLocal(currentSession.user);
      setUser(appUser);
      setSession(currentSession);
    } else {
      setUser(null);
      setSession(null);
    }
    setIsLoading(false);
  }, []);


  useEffect(() => {
    setIsLoading(true);
    // Check initial session state
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      processUserSession(initialSession);
    }).catch(err => {
        console.error("Error getting initial session:", err);
        processUserSession(null); // Ensure loading finishes and state is cleared
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, currentSession: SupabaseSession | null) => {
        // Note: It's important to set loading true *before* async operations inside processUserSession
        // if processUserSession itself becomes async beyond simple state setting.
        // For now, processUserSession is synchronous.
        setIsLoading(true); 
        processUserSession(currentSession);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [processUserSession]);
  
  // Manually fetch/refresh current user details if needed (e.g., after profile update not reflected in session)
  const fetchCurrentUser = useCallback(async () => {
    setIsLoading(true);
    try {
      // apiService.getCurrentUser() should internally use supabase.auth.getUser()
      // which fetches the latest user data from the server.
      const fetchedUser = await apiService.getCurrentUser(); 
      setUser(fetchedUser); 
      
      // Also refresh the session object from Supabase
      const { data: { session: currentSupabaseSession } } = await supabase.auth.getSession();
      setSession(currentSupabaseSession);

    } catch (error) {
      console.error("fetchCurrentUser failed:", error);
      // Optionally clear user/session if fetch implies they are invalid
      // setUser(null); 
      // setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);


  const login = async (email: string, password_unused: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // apiService.login now uses supabase.auth.signInWithPassword
      // onAuthStateChange will handle setting user and session state.
      await apiService.login(email, password_unused); 
      // setIsLoading(false) will be handled by onAuthStateChange listener setting isLoading to false
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false); // Explicitly set loading false on error
      setUser(null); 
      setSession(null);
      return false;
    }
  };

  const signup = async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      // apiService.signup now uses supabase.auth.signUp
      const result = await apiService.signup(username, email, password_unused, role);
      // setIsLoading(false) will be handled by onAuthStateChange or if no auth state change, here
      // If email confirmation is required, onAuthStateChange might not fire immediately with a user.
      if (!result.success || (result.message.includes("Check your email") && !result.user)) {
         setIsLoading(false); // Stop loading if signup requires confirmation and no immediate session
      }
      return result;
    } catch (error) {
      console.error("Signup failed:", error);
      setIsLoading(false);
      return { success: false, message: error instanceof Error ? error.message : 'An unknown error occurred during signup.' };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
        await apiService.logout(); // Uses supabase.auth.signOut()
        // onAuthStateChange will set user/session to null and isLoading to false.
    } catch(error) {
        console.error("Logout failed:", error);
        // Still attempt to clear client-side state and stop loading
        setUser(null);
        setSession(null);
        setIsLoading(false);
    }
  };
  
  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAuthenticated: !!session && !!user, 
      isLoading, 
      login, 
      signup, 
      logout,
      fetchCurrentUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
