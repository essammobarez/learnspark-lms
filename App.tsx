
import React from 'react';
// Fix: Changed react-router-dom imports to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'; // Updated for v6+
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext'; // Import ThemeProvider
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage'; // Import SignupPage
import StudentDashboard from './pages/StudentDashboard';
import InstructorDashboard from './pages/InstructorDashboard';
import CourseListPage from './pages/CourseListPage';
import CourseDetailPage from './pages/CourseDetailPage';
import CreateCoursePage from './pages/CreateCoursePage';
import EditCoursePage from './pages/EditCoursePage'; 
import CreateQuizPage from './pages/CreateQuizPage';
import CreateQuizWithGamePage from './pages/CreateQuizWithGamePage'; 
import QuizPage from './pages/QuizPage';
import LiveSessionPage from './pages/LiveSessionPage';
import HostQuizSessionPage from './pages/HostQuizSessionPage'; 
import JoinQuizWithPage from './pages/JoinQuizWithPage'; 
import StudentReportsPage from './pages/StudentReportsPage'; 
import InstructorReportsPage from './pages/InstructorReportsPage'; 
import { APP_NAME, ROUTES } from './constants';
import { UserRole } from './types';
import LoadingSpinner from './components/LoadingSpinner';

interface ProtectedRouteProps {
  element: JSX.Element; // In v6, the component to render is passed as an element
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ element, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><LoadingSpinner /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    let redirectPath = ROUTES.HOME; // Default redirect
    if (user.role === UserRole.STUDENT) redirectPath = ROUTES.STUDENT_DASHBOARD;
    if (user.role === UserRole.INSTRUCTOR) redirectPath = ROUTES.INSTRUCTOR_DASHBOARD;
    // For admin, you might want a specific admin dashboard or fallback to home
    if (user.role === UserRole.ADMIN && ROUTES.ADMIN_DASHBOARD) redirectPath = ROUTES.ADMIN_DASHBOARD;
    
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  return element; // Render the protected element
};


const AppRoutes: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth(); 
  
  const getHomeRoute = () => {
    // Do not determine home route if still loading auth state, to prevent premature redirects.
    // The main AppRoutes component will show a spinner if isLoading.
    if (!isAuthenticated || !user) return ROUTES.COURSE_LIST; // Default for guests
    switch (user.role) {
      case UserRole.STUDENT: return ROUTES.STUDENT_DASHBOARD;
      case UserRole.INSTRUCTOR: return ROUTES.INSTRUCTOR_DASHBOARD;
      case UserRole.ADMIN: return ROUTES.ADMIN_DASHBOARD || ROUTES.COURSE_LIST; // Fallback if admin dashboard not defined
      default: return ROUTES.COURSE_LIST;
    }
  };
  
  // Show a global loading spinner if auth state is still loading.
  // This prevents routes from attempting to render or redirect prematurely.
  if (isLoading) { 
      return (
          <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><LoadingSpinner /></div>
      );
  }
  
  return (
    <Routes> {/* Updated for v6+ */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} /> {/* Updated for v6+ */}
      <Route path={ROUTES.SIGNUP} element={<SignupPage />} /> {/* Updated for v6+ */}
      <Route path={ROUTES.COURSE_LIST} element={<CourseListPage />} /> 
      <Route path={ROUTES.COURSE_DETAIL} element={<CourseDetailPage />} /> 
      <Route path={ROUTES.JOIN_QUIZ_WITH} element={<JoinQuizWithPage />} />
      
      {/* Student Routes */}
      <Route path={ROUTES.STUDENT_DASHBOARD} element={
          <ProtectedRoute allowedRoles={[UserRole.STUDENT]} element={<StudentDashboard />} />
      }/>
      <Route path={ROUTES.STUDENT_REPORTS} element={
          <ProtectedRoute allowedRoles={[UserRole.STUDENT]} element={<StudentReportsPage />} />
      }/>
      
      {/* Instructor Routes */}
      <Route path={ROUTES.INSTRUCTOR_DASHBOARD} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<InstructorDashboard />} />
      }/>
      <Route path={ROUTES.CREATE_COURSE} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<CreateCoursePage />} />
      }/>
      <Route path={ROUTES.EDIT_COURSE} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<EditCoursePage />} />
      }/>
      <Route path={ROUTES.CREATE_QUIZ} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<CreateQuizPage />} />
      }/>
       <Route path={ROUTES.CREATE_QUIZWITH_GAME} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<CreateQuizWithGamePage />} />
      }/>
      <Route path={ROUTES.HOST_QUIZ_SESSION} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<HostQuizSessionPage/>} />
      }/>
      <Route path={ROUTES.INSTRUCTOR_REPORTS} element={
          <ProtectedRoute allowedRoles={[UserRole.INSTRUCTOR]} element={<InstructorReportsPage />} />
      }/>

      {/* Shared Routes (requires login) */}
      <Route path={ROUTES.QUIZ} element={
          <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.INSTRUCTOR]} element={<QuizPage />} />
      }/>
      <Route path={ROUTES.LIVE_SESSION} element={
          <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.INSTRUCTOR]} element={<LiveSessionPage />} />
      }/>
      
      <Route path={ROUTES.HOME} element={<Navigate to={getHomeRoute()} replace />} /> {/* Updated for v6+ */}
      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} /> {/* Updated for v6+ */}
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider> 
        <HashRouter>
          <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300 ease-in-out">
            <Navbar />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <AppRoutes />
            </main>
          </div>
        </HashRouter>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;