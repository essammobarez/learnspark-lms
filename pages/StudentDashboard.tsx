
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Course } from '../types';
import { mockApiService } from '../services/mockApiService';
import LoadingSpinner from '../components/LoadingSpinner';
import CourseCard from '../components/CourseCard';
// Fix: Ensured Link is imported correctly for react-router-dom.
// Confirmed react-router-dom import syntax for v6+.
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import Button from '../components/Button';
import { BookOpenIcon, ChartBarIcon, AcademicCapIcon } from '@heroicons/react/24/outline';


const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      if (user) {
        setIsLoading(true);
        const courses = await mockApiService.getEnrolledCourses(user.id);
        setEnrolledCourses(courses);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    };
    fetchEnrolledCourses();
  }, [user]);

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /> <p className="mt-3 text-gray-600 dark:text-gray-400">Loading your courses...</p></div>;
  }

  if (!user) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md transition-colors duration-300 ease-in-out">
        <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
        <h2 className="text-xl font-medium text-gray-900 dark:text-white">Please Log In</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Login to access your student dashboard.</p>
        <div className="mt-6">
            <Link to={ROUTES.LOGIN}>
                <Button variant="primary">Login</Button>
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">My Learning</h1>
        <Link to={ROUTES.STUDENT_REPORTS} className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 mr-2" /> View My Quiz Reports
            </Button>
        </Link>
      </div>

      {enrolledCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {enrolledCourses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
          <BookOpenIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">Your Learning Journey Awaits!</h2>
          <p className="mt-2 text-md text-gray-600 dark:text-gray-400">You haven't enrolled in any courses yet. Explore our catalog and start learning something new today.</p>
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