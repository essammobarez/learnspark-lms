
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Course, UserRole } from '../types';
import { apiService } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import CourseCard from '../components/CourseCard';
import Button from '../components/Button';
import { ROUTES } from '../constants';
import { PlusCircleIcon, PresentationChartLineIcon, BookOpenIcon, ChartBarIcon, AcademicCapIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';


const InstructorDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseEnrollmentCounts, setCourseEnrollmentCounts] = useState<{[courseId: string]: number}>({});
  const [courseRatingCounts, setCourseRatingCounts] = useState<{[courseId: string]: number}>({});
  const [countsLoading, setCountsLoading] = useState(false);

  const fetchCoursesAndCounts = useCallback(async () => {
    if (user && isAuthenticated && user.role === UserRole.INSTRUCTOR) {
      setIsLoading(true);
      setError(null);
      setCourseEnrollmentCounts({});
      setCourseRatingCounts({});
      try {
        const courses = await apiService.getCreatedCourses();
        setCreatedCourses(courses);

        if (courses.length > 0) {
          setCountsLoading(true);
          const enrollmentPromises = courses.map(course =>
            apiService.getEnrollmentCountForCourse(course.id)
              .then(count => ({ courseId: course.id, count }))
              .catch(err => ({ courseId: course.id, count: course.enrollmentCount ?? 0 }))
          );
          const ratingPromises = courses.map(course =>
            apiService.getRatingsCountForCourse(course.id)
              .then(count => ({ courseId: course.id, count }))
              .catch(err => ({ courseId: course.id, count: 0 }))
          );

          const [enrollmentResults, ratingResults] = await Promise.all([
            Promise.all(enrollmentPromises),
            Promise.all(ratingPromises)
          ]);
          
          const newEnrollmentCounts: { [courseId: string]: number } = {};
          enrollmentResults.forEach(r => newEnrollmentCounts[r.courseId] = r.count);
          setCourseEnrollmentCounts(newEnrollmentCounts);

          const newRatingCounts: { [courseId: string]: number } = {};
          ratingResults.forEach(r => newRatingCounts[r.courseId] = r.count);
          setCourseRatingCounts(newRatingCounts);
          setCountsLoading(false);
        }
      } catch (e) {
        console.error("Failed to fetch created courses or counts:", e);
        setError("Could not load your created courses. Please try again later.");
      } finally {
        setIsLoading(false);
        setCountsLoading(false);
      }
    } else {
      setIsLoading(false);
      if (isAuthenticated && user?.role !== UserRole.INSTRUCTOR) {
         setError("Access denied. You are not an instructor.");
      }
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchCoursesAndCounts();
  }, [fetchCoursesAndCounts]);

  if (isLoading && createdCourses.length === 0) { // Main loader
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /><p className="mt-3 text-gray-600">Loading your dashboard...</p></div>;
  }
  
  if (!isAuthenticated || !user || user.role !== UserRole.INSTRUCTOR) {
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-md transition-colors duration-300 ease-in-out">
        <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-medium text-gray-900">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500">{error || "You need to be logged in as an instructor to view this page."}</p>
        <div className="mt-6">
            <Link to={ROUTES.LOGIN}>
                <Button variant="primary">Login as Instructor</Button>
            </Link>
        </div>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-md">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-red-700">Error Loading Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button onClick={fetchCoursesAndCounts} className="mt-4">Try Again</Button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-200 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Instructor Hub</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-wrap justify-center sm:justify-end">
          <Link to={ROUTES.CREATE_COURSE} className="w-full sm:w-auto">
            <Button variant="primary" className="w-full flex items-center justify-center">
                <PlusCircleIcon className="w-5 h-5 mr-2" /> Create New Course
            </Button>
          </Link>
          <Link to={ROUTES.CREATE_QUIZWITH_GAME} className="w-full sm:w-auto">
            <Button variant="success" className="w-full flex items-center justify-center">
                <PresentationChartLineIcon className="w-5 h-5 mr-2" /> Create QuizWith Game
            </Button>
          </Link>
           <Link to={ROUTES.INSTRUCTOR_REPORTS} className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 mr-2" /> View Quiz Reports
            </Button>
          </Link>
        </div>
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-800">My Created Courses</h2>
      {isLoading && createdCourses.length > 0 && ( // Secondary loader for counts
        <div className="text-center text-sm text-gray-500 py-2 flex items-center justify-center">
          <LoadingSpinner /> <span className="ml-2">Updating course stats...</span>
        </div>
      )}
      {countsLoading && !isLoading && ( // Loader for counts
        <div className="text-center text-sm text-gray-500 py-2 flex items-center justify-center">
          <LoadingSpinner /> <span className="ml-2">Updating course stats...</span>
        </div>
      )}

      {createdCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {createdCourses.map(course => (
            <CourseCard 
              key={course.id} 
              course={course} 
              isAuthenticated={isAuthenticated} 
              actualEnrollmentCount={courseEnrollmentCounts[course.id]}
              actualRatingsCount={courseRatingCounts[course.id]}
            />
          ))}
        </div>
      ) : (
         !isLoading && // Don't show "no courses" if still in primary loading phase
        <div className="text-center py-12 bg-white rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
           <BookOpenIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Share Your Expertise!</h2>
          <p className="mt-2 text-md text-gray-600">You haven't created any courses yet. It's time to build something amazing and share your knowledge with the world.</p>
          <div className="mt-8">
            <Link to={ROUTES.CREATE_COURSE}>
                <Button variant="primary" size="lg">Create Your First Course</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorDashboard;