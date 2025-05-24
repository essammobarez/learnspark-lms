
import React, { useEffect, useState } from 'react';
// Fix: Ensured Link is imported correctly for react-router-dom.
// Confirmed react-router-dom import syntax for v6+.
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Course, UserRole } from '../types';
import { mockApiService } from '../services/mockApiService';
import LoadingSpinner from '../components/LoadingSpinner';
import CourseCard from '../components/CourseCard';
import Button from '../components/Button';
import { ROUTES } from '../constants';
import { PlusCircleIcon, PresentationChartLineIcon, BookOpenIcon, ChartBarIcon, AcademicCapIcon } from '@heroicons/react/24/outline';


const InstructorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCreatedCourses = async () => {
      if (user) {
        setIsLoading(true);
        const courses = await mockApiService.getCreatedCourses(user.id);
        setCreatedCourses(courses);
        setIsLoading(false);
      } else {
          setIsLoading(false);
      }
    };
    fetchCreatedCourses();
  }, [user]);

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /><p className="mt-3 text-gray-600 dark:text-gray-400">Loading your dashboard...</p></div>;
  }
  
  if (!user || user.role !== UserRole.INSTRUCTOR) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md transition-colors duration-300 ease-in-out">
        <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
        <h2 className="text-xl font-medium text-gray-900 dark:text-white">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">You need to be logged in as an instructor to view this page.</p>
        <div className="mt-6">
            <Link to={ROUTES.LOGIN}>
                <Button variant="primary">Login as Instructor</Button>
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Instructor Hub</h1>
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
      
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">My Created Courses</h2>
      {createdCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {createdCourses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
           <BookOpenIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">Share Your Expertise!</h2>
          <p className="mt-2 text-md text-gray-600 dark:text-gray-400">You haven't created any courses yet. It's time to build something amazing and share your knowledge with the world.</p>
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