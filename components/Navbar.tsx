
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { APP_NAME, ROUTES } from '../constants';
import { UserRole } from '../types';
import Button from './Button';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate(ROUTES.LOGIN);
  };

  const commonLinkClasses = "text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const mobileLinkClasses = "block text-gray-700 hover:text-blue-600 hover:bg-gray-100 px-3 py-2 rounded-md text-base font-medium transition-colors";

  const navLinks = (
    <>
      <Link to={ROUTES.COURSE_LIST} className={isMobileMenuOpen ? mobileLinkClasses : commonLinkClasses} onClick={() => setIsMobileMenuOpen(false)}>Courses</Link>
      <Link to={ROUTES.JOIN_QUIZ_WITH} className={isMobileMenuOpen ? mobileLinkClasses : commonLinkClasses} onClick={() => setIsMobileMenuOpen(false)}>Join QuizWith</Link>
      {isAuthenticated && user && user.role === UserRole.STUDENT && (
        <Link to={ROUTES.STUDENT_DASHBOARD} className={isMobileMenuOpen ? mobileLinkClasses : `${commonLinkClasses} hidden sm:block`} onClick={() => setIsMobileMenuOpen(false)}>My Dashboard</Link>
      )}
      {isAuthenticated && user && user.role === UserRole.INSTRUCTOR && (
        <Link to={ROUTES.INSTRUCTOR_DASHBOARD} className={isMobileMenuOpen ? mobileLinkClasses : `${commonLinkClasses} hidden sm:block`} onClick={() => setIsMobileMenuOpen(false)}>Instructor Hub</Link>
      )}
    </>
  );

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 transition-colors duration-300 ease-in-out">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to={ROUTES.HOME} className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
              {APP_NAME}
            </Link>
          </div>
          
          {/* Desktop Menu & Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {navLinks}
            {isAuthenticated && user ? (
              <>
                <span className="text-gray-700 text-sm hidden lg:block">Welcome, {user.username.split(' ')[0]}!</span>
                <Button onClick={handleLogout} variant="secondary" size="sm">Logout</Button>
              </>
            ) : (
              <Link to={ROUTES.LOGIN}>
                  <Button variant="primary" size="sm">Login</Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            {isAuthenticated && user && (
                 <Button onClick={handleLogout} variant="secondary" size="sm" className="mr-2 sm:mr-3">Logout</Button>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute w-full bg-white shadow-lg z-40" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks}
            {/* The dashboard links (Student/Instructor) are now handled by navLinks above,
                which correctly applies mobileLinkClasses when isMobileMenuOpen is true.
                The explicit sm:hidden links previously here were redundant. */}

            {!isAuthenticated && (
              <Link to={ROUTES.LOGIN} className={mobileLinkClasses} onClick={() => setIsMobileMenuOpen(false)}>
                Login
              </Link>
            )}
            {/* 
              If logout button needs to be inside the toggled menu for mobile (instead of always visible):
              {isAuthenticated && user && (
                <Button onClick={handleLogout} variant="secondary" size="sm" className="w-full mt-2">Logout</Button>
              )}
            */}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
