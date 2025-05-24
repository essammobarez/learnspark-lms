
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, APP_NAME } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserRole } from '../types';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    
    if (!success) {
      setError('Invalid email or password. Please try again.');
    }
    // Navigation is handled by the useEffect hook above once isAuthenticated and user are updated.
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 py-12 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-xl shadow-2xl transition-colors duration-300 ease-in-out">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Sign in to {APP_NAME}
          </h2>
          {(location.state as any)?.signupSuccess && (
            <p className="mt-2 text-center text-sm text-green-600 dark:text-green-400">
              {(location.state as any)?.message || 'Signup successful! Please log in.'}
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
          <div>
            <Button type="submit" variant="primary" className="w-full flex justify-center py-3 text-lg" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner /> : 'Sign in'}
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          No account?{' '}
          <Link to={ROUTES.SIGNUP} className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;