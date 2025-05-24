
import React from 'react';
// Fix: Ensured Link is imported correctly for react-router-dom.
// Confirmed react-router-dom import syntax for v6+.
import { Link } from 'react-router-dom';
import { Course } from '../types';
import Button from './Button';
import { StarIcon } from '@heroicons/react/24/solid'; 

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden flex flex-col h-full transition-all duration-300 ease-in-out hover:shadow-xl dark:hover:shadow-blue-500/30 hover:scale-[1.03]">
      <Link to={`/courses/${course.id}`} className="block">
        <img className="w-full h-48 sm:h-56 object-cover" src={course.imageUrl} alt={course.title} />
      </Link>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          <Link to={`/courses/${course.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 transition-colors" title={course.title}>{course.title}</Link>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">By {course.instructorName}</p>
        <div className="flex items-center mb-3">
          <span className="text-yellow-500 dark:text-yellow-400 font-bold mr-1">{course.rating.toFixed(1)}</span>
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <StarIcon key={i} className={`h-4 w-4 ${i < Math.round(course.rating) ? 'text-yellow-400 dark:text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`} />
            ))}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({course.enrollmentCount.toLocaleString()} students)</span>
        </div>
        <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 flex-grow line-clamp-3">
          {course.description}
        </p>
        <div className="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
          <Link to={`/courses/${course.id}`}>
            <Button variant="primary" className="w-full">View Course Details</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;