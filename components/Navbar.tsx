
import React from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { Link, useNavigate } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { useAuth } from '../hooks/useAuth';
// import { useTheme } from '../hooks/useTheme'; // Removed useTheme import
import { APP_NAME, ROUTES } from '../constants';
import { UserRole } from '../types';
import Button from './Button';
// import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'; // Removed icon imports

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, setUserRoleForDev } = useAuth();
  // const { theme, toggleTheme } = useTheme(); // Removed theme state and toggle function
  const navigate = useNavigate(); // Updated for v6+

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN); // Updated for v6+
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50 transition-colors duration-300 ease-in-out">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to={ROUTES.HOME} className="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 transition-colors">
              {APP_NAME}
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link to={ROUTES.COURSE_LIST} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded-md text-sm font-medium transition-colors">Courses</Link>
            <Link to={ROUTES.JOIN_QUIZ_WITH} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded-md text-sm font-semibold transition-colors">Join QuizWith</Link>
            
            {isAuthenticated && user ? (
              <>
                {user.role === UserRole.STUDENT && (
                  <Link to={ROUTES.STUDENT_DASHBOARD} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded-md text-sm font-medium transition-colors hidden sm:block">My Dashboard</Link>
                )}
                {user.role === UserRole.INSTRUCTOR && (
                  <Link to={ROUTES.INSTRUCTOR_DASHBOARD} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded-md text-sm font-medium transition-colors hidden sm:block">Instructor Hub</Link>
                )}
                <span className="text-gray-700 dark:text-gray-300 text-sm hidden md:block">Welcome, {user.username.split(' ')[0]}!</span>
                <Button onClick={handleLogout} variant="secondary" size="sm">Logout</Button>
              </>
            ) : (
              <>
                <div className="hidden lg:flex items-center ml-2 p-1 border border-gray-200 dark:border-gray-700 rounded text-xs bg-gray-50 dark:bg-gray-700">
                    <span className="mr-1 text-gray-500 dark:text-gray-400">Dev:</span>
                    <button onClick={() => setUserRoleForDev(UserRole.STUDENT)} className="mr-1 text-blue-500 dark:text-blue-400 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 rounded px-1">Student</button>
                    <button onClick={() => setUserRoleForDev(UserRole.INSTRUCTOR)} className="text-green-500 dark:text-green-400 hover:underline focus:outline-none focus:ring-1 focus:ring-green-400 dark:focus:ring-green-500 rounded px-1">Instructor</button>
                </div>
                <Link to={ROUTES.LOGIN}>
                    <Button variant="primary" size="sm">Login</Button>
                </Link>
              </>
            )}
             {/* Removed theme toggle button
             <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              {theme === 'light' ? (
                <MoonIcon className="h-5 w-5" />
              ) : (
                <SunIcon className="h-5 w-5" />
              )}
            </button>
            */}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
