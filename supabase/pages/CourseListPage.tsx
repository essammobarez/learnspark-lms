
import React, { useEffect, useState } from 'react';
import { Course } from '../types';
import { apiService } from '../services/apiService'; // Use real API service
import LoadingSpinner from '../components/LoadingSpinner';
import CourseCard from '../components/CourseCard';
import Input from '../components/Input';
import { MagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from '../components/Button';

const CourseListPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchCourses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCourses = await apiService.getCourses();
      setCourses(fetchedCourses);
    } catch (e) {
      console.error("Failed to fetch courses:", e);
      setError("Could not load courses. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);
  
  const categories = ['All', ...new Set(courses.map(course => course.category).filter(Boolean))];

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategory === 'All' || course.category === selectedCategory)
  );

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /><p className="mt-3 text-gray-600 dark:text-gray-400">Loading courses...</p></div>;
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
        <h2 className="text-xl font-medium text-red-700 dark:text-red-400">Error Loading Courses</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <Button onClick={fetchCourses} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">Explore Our Courses</h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Find your next learning adventure among our curated courses designed to help you grow.</p>
      </div>

      <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg space-y-4 sm:space-y-0 sm:flex sm:flex-row sm:gap-4 sm:items-center sm:justify-between transition-colors duration-300 ease-in-out">
        <div className="flex-grow w-full sm:w-auto">
           <Input
            type="text"
            placeholder="Search courses by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search courses"
            className="dark:bg-gray-700"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Category:</label>
            <select
                id="category-filter"
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300 ease-in-out"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
            >
            {categories.map(category => (
                <option key={category} value={category}>{category}</option>
            ))}
            </select>
        </div>
      </div>

      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {filteredCourses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
            <MagnifyingGlassIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
            <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">No Courses Found</h2>
            <p className="mt-2 text-md text-gray-600 dark:text-gray-400">We couldn't find any courses matching your criteria. Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  );
};

export default CourseListPage;