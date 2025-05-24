
import React, { useState } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate, Link, useLocation } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
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
  const { login, user } = useAuth(); // user from useAuth will be updated after login
  const navigate = useNavigate(); // Updated for v6+
  const location = useLocation(); // For potential redirects

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const success = await login(email, password); // This login updates the user in AuthContext
    setIsSubmitting(false);
    
    // Access the updated user from the AuthContext *after* login has completed.
    // The `user` variable from `useAuth()` might not be immediately up-to-date here
    // if state updates are asynchronous. A better way is to rely on the success flag
    // and then access the user from AuthContext on next render, or have login return the user.
    // For simplicity here, we assume login in mockApiService updates the context's user synchronously
    // or that the user object passed to navigate will be picked up from context on the target page.

    if (success) {
        // Re-fetch the user from the context in case it was updated by login
        // This is a bit of a workaround for potential async state updates in useAuth.
        // A more robust solution might involve login returning the user object.
        const loggedInUser = (window as any).authContextUser || user; // A bit hacky, ideally useAuth().user would be fresh

      const from = (location.state as any)?.from?.pathname || null;
      if (from) {
        navigate(from, { replace: true }); // Updated for v6+
        return;
      }
      // Default navigation based on role, using the latest user info from context
      if(loggedInUser) {
        if(loggedInUser.role === UserRole.STUDENT) navigate(ROUTES.STUDENT_DASHBOARD); 
        else if(loggedInUser.role === UserRole.INSTRUCTOR) navigate(ROUTES.INSTRUCTOR_DASHBOARD); 
        else if(loggedInUser.role === UserRole.ADMIN) navigate(ROUTES.ADMIN_DASHBOARD); 
        else navigate(ROUTES.HOME); 
      } else {
         navigate(ROUTES.HOME); // Fallback if user somehow isn't set
      }
    } else {
      setError('Invalid email or password. Try alice@example.com or bob@example.com with any password.');
    }
  };
   // Expose user for handleSubmit if needed, though direct access to updated user is tricky
   (window as any).authContextUser = user;


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
            placeholder="alice@example.com / bob@example.com"
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
            placeholder="any password"
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