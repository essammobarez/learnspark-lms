
import React, { useState } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate, Link } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { mockApiService } from '../services/mockApiService';
import { ROUTES, APP_NAME } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserRole } from '../types';

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate(); // Updated for v6+

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('All fields except confirm password (if matching) are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    const result = await mockApiService.signup(username, email, password, role);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage(result.message + ' You will be redirected to login shortly.');
      setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
      setTimeout(() => {
        navigate(ROUTES.LOGIN, { state: { signupSuccess: true, email, message: result.message } }); // Updated for v6+: Pass state to login page
      }, 3000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600 dark:from-green-700 dark:to-teal-800 py-12 px-4 sm:px-6 lg:px-8 transition-all duration-300 ease-in-out">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-xl shadow-2xl transition-colors duration-300 ease-in-out">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Create your {APP_NAME} Account
          </h2>
        </div>
        {successMessage && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-700/30 border border-green-300 dark:border-green-600 rounded-md text-green-700 dark:text-green-300 text-center text-sm">
            {successMessage}
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <Input
            label="Username"
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
          />
          <Input
            label="Email address"
            id="email-signup" 
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
            id="password-signup" 
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
          />
          <Input
            label="Confirm Password"
            id="confirm-password"
            name="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">I want to sign up as a:</label>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  id="role-student"
                  name="role"
                  type="radio"
                  value={UserRole.STUDENT}
                  checked={role === UserRole.STUDENT}
                  onChange={() => setRole(UserRole.STUDENT)}
                  className="focus:ring-blue-500 dark:focus:ring-blue-400 h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600"
                />
                <label htmlFor="role-student" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                  Student
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="role-instructor"
                  name="role"
                  type="radio"
                  value={UserRole.INSTRUCTOR}
                  checked={role === UserRole.INSTRUCTOR}
                  onChange={() => setRole(UserRole.INSTRUCTOR)}
                  className="focus:ring-green-500 dark:focus:ring-green-400 h-4 w-4 text-green-600 dark:text-green-400 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600"
                />
                <label htmlFor="role-instructor" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                  Instructor
                </label>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/30 p-2 rounded-md">{error}</p>}
          
          <div>
            <Button type="submit" variant="primary" className="w-full flex justify-center py-3 text-lg" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner /> : 'Sign up'}
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;