
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Course } from '../types';
import { apiService } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import CourseCard from '../components/CourseCard';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import Button from '../components/Button';
import { BookOpenIcon, ChartBarIcon, AcademicCapIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';


const StudentDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseEnrollmentCounts, setCourseEnrollmentCounts] = useState<{[courseId: string]: number}>({});
  const [courseRatingCounts, setCourseRatingCounts] = useState<{[courseId: string]: number}>({});
  const [countsLoading, setCountsLoading] = useState(false);

  const fetchCoursesAndCounts = useCallback(async () => {
    if (user && isAuthenticated) {
      setIsLoading(true);
      setError(null);
      setCourseEnrollmentCounts({});
      setCourseRatingCounts({});
      try {
        const courses = await apiService.getEnrolledCourses();
        setEnrolledCourses(courses);

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
        console.error("Failed to fetch enrolled courses or counts:", e);
        setError("Could not load your courses. Please try again later.");
      } finally {
        setIsLoading(false);
        setCountsLoading(false);
      }
    } else {
      setIsLoading(false);
      setEnrolledCourses([]);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchCoursesAndCounts();
  }, [fetchCoursesAndCounts]);

  if (isLoading && enrolledCourses.length === 0) { // Show main loader if initial course list is loading
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /> <p className="mt-3 text-gray-600">Loading your courses...</p></div>;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-md transition-colors duration-300 ease-in-out">
        <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-medium text-gray-900">Please Log In</h2>
        <p className="mt-1 text-sm text-gray-500">Login to access your student dashboard.</p>
        <div className="mt-6">
            <Link to={ROUTES.LOGIN}>
                <Button variant="primary">Login</Button>
            </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-md">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-red-700">Error Loading Courses</h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button onClick={fetchCoursesAndCounts} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-200 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">My Learning</h1>
        <Link to={ROUTES.STUDENT_REPORTS} className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 mr-2" /> View My Quiz Reports
            </Button>
        </Link>
      </div>

      {isLoading && enrolledCourses.length > 0 && ( // Secondary loader for counts if courses already listed
        <div className="text-center text-sm text-gray-500 py-2 flex items-center justify-center">
          <LoadingSpinner /> <span className="ml-2">Updating course stats...</span>
        </div>
      )}
      {countsLoading && !isLoading && ( // Loader for counts if main loading is done
        <div className="text-center text-sm text-gray-500 py-2 flex items-center justify-center">
          <LoadingSpinner /> <span className="ml-2">Updating course stats...</span>
        </div>
      )}

      {enrolledCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {enrolledCourses.map(course => (
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
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Your Learning Journey Awaits!</h2>
          <p className="mt-2 text-md text-gray-600">You haven't enrolled in any courses yet. Explore our catalog and start learning something new today.</p>
          <div className="mt-8">
            <Link to={ROUTES.COURSE_LIST}>
                <Button variant="primary" size="lg">Browse Courses</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;