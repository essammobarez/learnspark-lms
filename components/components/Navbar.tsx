
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { APP_NAME, ROUTES } from '../../constants';
import { UserRole } from '../../types';
import Button from './Button';
// import ThemeToggleButton from './ThemeToggleButton'; // Removed import for ThemeToggleButton

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 transition-colors duration-300 ease-in-out">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to={ROUTES.HOME} className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
              {APP_NAME}
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link to={ROUTES.COURSE_LIST} className="text-gray-700 hover:text-blue-600 px-2 py-1 rounded-md text-sm font-medium transition-colors">Courses</Link>
            <Link to={ROUTES.JOIN_QUIZ_WITH} className="text-gray-700 hover:text-blue-600 px-2 py-1 rounded-md text-sm font-semibold transition-colors">Join QuizWith</Link>
            
            {/* <ThemeToggleButton /> */} {/* Removed ThemeToggleButton here */}

            {isAuthenticated && user ? (
              <>
                {user.role === UserRole.STUDENT && (
                  <Link to={ROUTES.STUDENT_DASHBOARD} className="text-gray-700 hover:text-blue-600 px-2 py-1 rounded-md text-sm font-medium transition-colors hidden sm:block">My Dashboard</Link>
                )}
                {user.role === UserRole.INSTRUCTOR && (
                  <Link to={ROUTES.INSTRUCTOR_DASHBOARD} className="text-gray-700 hover:text-blue-600 px-2 py-1 rounded-md text-sm font-medium transition-colors hidden sm:block">Instructor Hub</Link>
                )}
                <span className="text-gray-700 text-sm hidden md:block">Welcome, {user.username.split(' ')[0]}!</span>
                <Button onClick={handleLogout} variant="secondary" size="sm">Logout</Button>
              </>
            ) : (
              <>
                {/* Removed Dev role switcher block */}
                <Link to={ROUTES.LOGIN}>
                    <Button variant="primary" size="sm">Login</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;