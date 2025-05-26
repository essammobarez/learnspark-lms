
import React, { useEffect, useState, useCallback } from 'react';
import { Course } from '../types';
import { apiService } from '../services/apiService'; 
import LoadingSpinner from '../components/LoadingSpinner';
import CourseCard from '../components/CourseCard';
import Input from '../components/Input';
import { MagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';

const CourseListPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [courseEnrollmentCounts, setCourseEnrollmentCounts] = useState<{[courseId: string]: number}>({});
  const [courseRatingCounts, setCourseRatingCounts] = useState<{[courseId: string]: number}>({}); // New state for ratings counts
  const [countsLoading, setCountsLoading] = useState(false);

  const { isAuthenticated } = useAuth();

  const fetchCoursesAndCounts = useCallback(async () => {
    setIsLoading(true);
    setCountsLoading(true); 
    setError(null);
    setCourseEnrollmentCounts({}); 
    setCourseRatingCounts({});

    try {
      const fetchedCourses = await apiService.getCourses();
      setCourses(fetchedCourses);
      
      if (fetchedCourses && fetchedCourses.length > 0) {
        const enrollmentCountsPromises = fetchedCourses.map(course => 
          apiService.getEnrollmentCountForCourse(course.id)
            .then(count => ({ courseId: course.id, count }))
            .catch(err => {
              console.warn(`Failed to fetch enrollment count for course ${course.id}:`, err);
              return { courseId: course.id, count: course.enrollmentCount ?? 0 }; 
            })
        );
        
        const ratingCountsPromises = fetchedCourses.map(course =>
          apiService.getRatingsCountForCourse(course.id)
            .then(count => ({ courseId: course.id, count }))
            .catch(err => {
              console.warn(`Failed to fetch ratings count for course ${course.id}:`, err);
              return { courseId: course.id, count: 0 }; // Default to 0 if error
            })
        );

        const [enrollmentResults, ratingResults] = await Promise.all([
            Promise.all(enrollmentCountsPromises),
            Promise.all(ratingCountsPromises)
        ]);
        
        const newEnrollmentCounts: {[courseId: string]: number} = {};
        enrollmentResults.forEach(result => {
          newEnrollmentCounts[result.courseId] = result.count;
        });
        setCourseEnrollmentCounts(newEnrollmentCounts);

        const newRatingCounts: {[courseId: string]: number} = {};
        ratingResults.forEach(result => {
            newRatingCounts[result.courseId] = result.count;
        });
        setCourseRatingCounts(newRatingCounts);
      }
    } catch (e) {
      console.error("Failed to fetch courses or counts:", e);
      setError("Could not load courses. Please try again later.");
    } finally {
      setIsLoading(false);
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoursesAndCounts();
  }, [fetchCoursesAndCounts]);
  
  const categories = ['All', ...new Set(courses.map(course => course.category).filter(Boolean))];

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategory === 'All' || course.category === selectedCategory)
  );

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /><p className="mt-3 text-gray-600">Loading courses...</p></div>;
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
    <div className="space-y-8 sm:space-y-10">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">Explore Our Courses</h1>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">Find your next learning adventure among our curated courses designed to help you grow.</p>
      </div>

      <div className="p-4 sm:p-6 bg-white rounded-xl shadow-lg space-y-4 sm:space-y-0 sm:flex sm:flex-row sm:gap-4 sm:items-center sm:justify-between transition-colors duration-300 ease-in-out">
        <div className="flex-grow w-full sm:w-auto">
           <Input
            type="text"
            placeholder="Search courses by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search courses"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">Category:</label>
            <select
                id="category-filter"
                className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full bg-white text-gray-900 transition-colors duration-300 ease-in-out"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
            >
            {categories.map(category => (
                <option key={category} value={category}>{category}</option>
            ))}
            </select>
        </div>
      </div>
      
      {countsLoading && courses.length > 0 && (
        <div className="text-center text-sm text-gray-500 py-2 flex items-center justify-center">
          <LoadingSpinner /> <span className="ml-2">Updating course stats...</span>
        </div>
      )}

      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {filteredCourses.map(course => (
            <CourseCard 
                key={course.id} 
                course={course} 
                actualEnrollmentCount={courseEnrollmentCounts[course.id]}
                actualRatingsCount={courseRatingCounts[course.id]} // Pass ratings count
                isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
            <MagnifyingGlassIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">No Courses Found</h2>
            <p className="mt-2 text-md text-gray-600">We couldn't find any courses matching your criteria. Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  );
};

export default CourseListPage;