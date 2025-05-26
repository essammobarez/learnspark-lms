
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, APP_NAME } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserRole } from '../types';

const REMEMBERED_EMAIL_KEY = 'learnspark-remembered-email';
const REMEMBERED_PASSWORD_KEY = 'learnspark-remembered-password'; // Key for storing password

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const from = (location.state as any)?.from?.pathname || null;

  // Effect for initial load: Pre-fill email and set "Remember me" if email was saved
  useEffect(() => {
    const lastRememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (lastRememberedEmail) {
      setEmail(lastRememberedEmail);
      setRememberMe(true); 
      // Password will be potentially auto-filled by the next useEffect if conditions match
    }
  }, []);

  // Effect for auto-filling password when email matches stored email and "Remember me" is checked
  useEffect(() => {
    if (rememberMe) {
      const storedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      const storedPassword = localStorage.getItem(REMEMBERED_PASSWORD_KEY);
      if (email === storedEmail && storedPassword) {
        if (password !== storedPassword) { // Avoid re-setting if already correct or user is typing
            setPassword(storedPassword);
        }
      }
    }
    // If rememberMe is false, or email doesn't match, we don't clear the password field here.
    // The user might be typing a new email and intends to type a new password, or unchecking "Remember me"
    // for the current session without wanting the typed password to disappear.
  }, [email, rememberMe]); // Run when email or rememberMe changes


  useEffect(() => {
    if (isAuthenticated && user) {
      const targetPath = from || 
                         (user.role === UserRole.STUDENT ? ROUTES.STUDENT_DASHBOARD :
                          user.role === UserRole.INSTRUCTOR ? ROUTES.INSTRUCTOR_DASHBOARD :
                          user.role === UserRole.ADMIN ? ROUTES.ADMIN_DASHBOARD : 
                          ROUTES.HOME);
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current); 
    }
    setError('');
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    
    if (success) {
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        localStorage.setItem(REMEMBERED_PASSWORD_KEY, password); // Store password
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        localStorage.removeItem(REMEMBERED_PASSWORD_KEY); // Remove stored password
      }
    } else {
      const errorMessage = 'Email not found in our database, or password incorrect. Try Sign Up if you are new.';
      setError(errorMessage);
      errorTimeoutRef.current = setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 py-12 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl transition-colors duration-300 ease-in-out">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to {APP_NAME}
          </h2>
          {(location.state as any)?.signupSuccess && (
            <p className="mt-2 text-center text-sm text-green-600">
              {(location.state as any)?.message || 'Signup successful! Please log in.'}
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <p id="login-error-message" className="text-sm text-red-600 text-left">{error}</p>}
          <Input
            label="Email address"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            error={error ? ' ' : undefined} 
            aria-describedby={error ? "login-error-message" : undefined}
          />
          <Input
            label="Password"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            error={error ? ' ' : undefined} 
            aria-describedby={error ? "login-error-message" : undefined}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded bg-white"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 select-none">
                Remember me
              </label>
            </div>
          </div>
          
          <div>
            <Button type="submit" variant="primary" className="w-full flex justify-center py-3 text-lg" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner /> : 'Sign in'}
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          No account?{' '}
          <Link to={ROUTES.SIGNUP} className="font-medium text-blue-600 hover:text-blue-500">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;