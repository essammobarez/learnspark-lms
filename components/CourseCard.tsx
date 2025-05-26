
import React from 'react';
import { Link } from 'react-router-dom';
import { Course } from '../types';
import Button from './Button';
import { StarIcon } from '@heroicons/react/24/solid'; 

interface CourseCardProps {
  course: Course;
  actualEnrollmentCount?: number;
  actualRatingsCount?: number; // New prop for ratings count
  isAuthenticated?: boolean;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, actualEnrollmentCount, actualRatingsCount, isAuthenticated }) => {
  const placeholderImageUrl = `https://via.placeholder.com/600x400.png?text=${encodeURIComponent(course.title || 'Course')}`;
  const imageUrl = course.imageUrl || placeholderImageUrl;

  let displayEnrollmentCount: number;
  if (isAuthenticated) {
    displayEnrollmentCount = (actualEnrollmentCount !== undefined && actualEnrollmentCount >= 0)
      ? actualEnrollmentCount
      : (course.enrollmentCount ?? 0);
  } else {
    displayEnrollmentCount = (actualEnrollmentCount !== undefined && actualEnrollmentCount > 0)
      ? actualEnrollmentCount
      : (course.enrollmentCount ?? 0);
  }

  const displayRatingsCount = (actualRatingsCount !== undefined && actualRatingsCount >= 0) 
    ? actualRatingsCount 
    : 0; // Default to 0 if not available

  const ratingsText = `${displayRatingsCount} rating${displayRatingsCount === 1 ? '' : 's'}`;
  const studentsText = `${displayEnrollmentCount.toLocaleString()} student${displayEnrollmentCount === 1 ? '' : 's'}`;
  
  let engagementText = '';
  if (displayRatingsCount > 0 && displayEnrollmentCount >= 0) {
    engagementText = `(${ratingsText}, ${studentsText})`;
  } else if (displayEnrollmentCount >= 0) {
    engagementText = `(${studentsText})`;
  } else if (displayRatingsCount > 0) {
    engagementText = `(${ratingsText})`;
  } else {
    engagementText = `(0 students)`; // Fallback if both are zero or undefined
  }


  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.03]">
      <Link to={`/courses/${course.id}`} className="block">
        <img 
          className="w-full h-48 sm:h-56 object-cover" 
          src={imageUrl} 
          alt={course.title} 
          onError={(e) => {
            if ((e.target as HTMLImageElement).src !== placeholderImageUrl) {
              (e.target as HTMLImageElement).src = placeholderImageUrl;
            }
          }}
        />
      </Link>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          <Link to={`/courses/${course.id}`} className="hover:text-blue-600 line-clamp-2 transition-colors" title={course.title}>{course.title}</Link>
        </h3>
        <p className="text-sm text-gray-500 mb-1">By {course.instructorName}</p>
        <div className="flex items-center mb-3">
          <span className="text-yellow-500 font-bold mr-1">{(course.rating ?? 0).toFixed(1)}</span>
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <StarIcon key={i} className={`h-4 w-4 ${i < Math.round(course.rating ?? 0) ? 'text-yellow-400' : 'text-gray-300'}`} />
            ))}
          </div>
          <span className="text-xs text-gray-500 ml-2">{engagementText}</span>
        </div>
        <p className="text-gray-700 text-sm mb-4 flex-grow line-clamp-3">
          {course.description}
        </p>
        <div className="mt-auto pt-3 border-t border-gray-200">
          <Link to={`/courses/${course.id}`}>
            <Button variant="primary" className="w-full">View Course Details</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;