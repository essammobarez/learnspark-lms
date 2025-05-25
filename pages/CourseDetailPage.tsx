
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Course, Lesson, Quiz, UserRole } from '../types';
import { apiService } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants';
import { PlayCircleIcon, DocumentTextIcon, PresentationChartBarIcon, PuzzlePieceIcon, PlusCircleIcon, VideoCameraIcon, PencilSquareIcon, PresentationChartLineIcon, StarIcon as StarSolidIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import { AcademicCapIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const CourseDetailPage: React.FC = () => {
  const { courseId: courseIdParam } = useParams<{ courseId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : null;

  const fetchCourseData = useCallback(async () => {
    if (!courseId || isNaN(courseId)) {
      setError("Invalid Course ID provided.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCourse = await apiService.getCourseById(courseId);
      setCourse(fetchedCourse);

      if (fetchedCourse) {
        const fetchedQuizzes = await apiService.getQuizzesForCourse(courseId);
        setQuizzes(fetchedQuizzes || []);

        if (user && isAuthenticated && user.enrolledCourseIds) { // user.id is number
          setIsEnrolled(user.enrolledCourseIds.includes(fetchedCourse.id));
        } else {
          setIsEnrolled(false);
        }
      } else {
        setError("Course not found.");
      }
    } catch (e) {
      console.error("Failed to fetch course details:", e);
      setError(e instanceof Error ? e.message : "An error occurred while fetching course details.");
      setCourse(null);
    } finally {
      setIsLoading(false);
    }
  }, [courseId, user, isAuthenticated]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  const handleEnroll = async () => {
    if (!user || !course || !courseId) return;
    setEnrollLoading(true);
    setError(null);
    try {
      const result = await apiService.enrollInCourse(courseId);
      if (result.success) {
        setIsEnrolled(true);
        // Optimistically update enrolled courses for current user or re-fetch user
        if (user && user.enrolledCourseIds) {
            user.enrolledCourseIds.push(courseId);
        }
        setCourse(prevCourse => prevCourse ? {...prevCourse, enrollmentCount: (prevCourse.enrollmentCount || 0) + 1} : null);
      } else {
        setError(result.message || "Enrollment failed. Please try again.");
      }
    } catch (e) {
      console.error("Enrollment error:", e);
      setError(e instanceof Error ? e.message : "An unexpected error occurred during enrollment.");
    } finally {
      setEnrollLoading(false);
    }
  };
  
  const getLessonIcon = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return <PlayCircleIcon className="w-6 h-6 mr-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />;
      case 'document': return <DocumentTextIcon className="w-6 h-6 mr-3 text-green-500 dark:text-green-400 flex-shrink-0" />;
      case 'presentation': return <PresentationChartBarIcon className="w-6 h-6 mr-3 text-purple-500 dark:text-purple-400 flex-shrink-0" />;
      default: return <AcademicCapIcon className="w-6 h-6 mr-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />; 
    }
  };

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /><p className="mt-3 text-gray-600 dark:text-gray-400">Loading course details...</p></div>;
  }

  if (error && !course) { 
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md transition-colors duration-300 ease-in-out">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
        <h2 className="text-2xl font-semibold text-red-700 dark:text-red-400">{error || "Course Not Found"}</h2>
        <p className="mt-2 text-md text-gray-600 dark:text-gray-400">We couldn't load the details for this course. It might have been removed or the link is incorrect.</p>
        <div className="mt-8">
            <Link to={ROUTES.COURSE_LIST}>
                <Button variant="primary">Back to Courses</Button>
            </Link>
        </div>
      </div>
    );
  }
  
  if (!course) { 
     return (
      <div className="text-center py-10">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500" />
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Course data is not available.</p>
        <Link to={ROUTES.COURSE_LIST}><Button variant="primary" className="mt-4">Go to Courses</Button></Link>
      </div>
    );
  }

  const isInstructorOwner = isAuthenticated && user?.role === UserRole.INSTRUCTOR && user.id === course.instructorId;

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300 ease-in-out">
      <header className="bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-900 dark:to-black text-white py-12 md:py-16 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">{course.title}</h1>
          <p className="text-lg sm:text-xl text-gray-300 dark:text-gray-400 mb-5 max-w-3xl">{course.description}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">Created by <span className="font-semibold text-gray-200 dark:text-gray-300">{course.instructorName}</span></p>
          <div className="flex items-center text-sm text-yellow-400 dark:text-yellow-300 mb-6">
            <StarSolidIcon className="w-5 h-5 text-yellow-400 dark:text-yellow-300 mr-1" />
            <span>{course.rating.toFixed(1)} rating ({course.enrollmentCount.toLocaleString()} students)</span>
            <span className="mx-2 text-gray-500 dark:text-gray-600">|</span>
            <span className="text-gray-300 dark:text-gray-400">{course.category}</span>
          </div>
           <div className="mt-6 flex flex-wrap gap-3">
            {isInstructorOwner && (
              <>
                <Link to={ROUTES.LIVE_SESSION.replace(':courseId', course.id.toString())}>
                  <Button variant="primary" size="md" className="flex items-center">
                    <VideoCameraIcon className="w-5 h-5 mr-2" /> Start Live Session
                  </Button>
                </Link>
                <Link to={ROUTES.EDIT_COURSE.replace(':courseId', course.id.toString())}>
                  <Button variant="secondary" size="md" className="flex items-center">
                    <PencilSquareIcon className="w-5 h-5 mr-2" /> Edit Course
                  </Button>
                </Link>
              </>
            )}
            {isAuthenticated && user?.role === UserRole.STUDENT && isEnrolled && (
               <Link to={ROUTES.LIVE_SESSION.replace(':courseId', course.id.toString())}>
                <Button variant="success" size="md" className="flex items-center">
                  <UserGroupIcon className="w-5 h-5 mr-2" /> Join Live Session
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <main className="lg:col-span-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-8 transition-colors duration-300 ease-in-out">
          {error && <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">Course Content</h2>
            {course.lessons && course.lessons.length > 0 ? (
              <ul className="space-y-4">
                {course.lessons.map((lesson, index) => (
                  <li key={lesson.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg dark:hover:bg-gray-700/50 transition-all duration-200 flex items-center">
                    {getLessonIcon(lesson.type)}
                    <div>
                      <span className="text-lg text-gray-800 dark:text-gray-100 font-medium">{index + 1}. {lesson.title}</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{lesson.type} - Content: {lesson.content.substring(0,50)}{lesson.content.length > 50 ? "..." : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 py-4 text-center italic">No lessons available yet for this course.</p>
            )}
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mt-10 mb-4">Quizzes</h3>
            {quizzes.length > 0 ? (
              <ul className="space-y-4">
                {quizzes.map(quiz => (
                  <li key={quiz.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg dark:hover:bg-gray-700/50 transition-all duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div className="flex items-center mb-2 sm:mb-0">
                        <PuzzlePieceIcon className="w-6 h-6 mr-3 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                        <span className="text-lg text-gray-800 dark:text-gray-100 font-medium">{quiz.title}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                          {(isEnrolled || isInstructorOwner) && quiz.questions && quiz.questions.length > 0 && (
                              <Link to={ROUTES.QUIZ.replace(':courseId', course.id.toString()).replace(':quizId', quiz.id.toString())} className="w-full sm:w-auto">
                              <Button variant="secondary" size="sm" className="w-full">Start Quiz</Button>
                              </Link>
                          )}
                          {isInstructorOwner && quiz.questions && quiz.questions.length > 0 && (
                              <Link to={ROUTES.HOST_QUIZ_SESSION.replace(':courseId', course.id.toString()).replace(':quizId', quiz.id.toString())} className="w-full sm:w-auto">
                                  <Button variant="primary" size="sm" className="w-full flex items-center justify-center">
                                      <PresentationChartLineIcon className="w-4 h-4 mr-1" /> Host QuizWith
                                  </Button>
                              </Link>
                          )}
                      </div>
                    </div>
                    {(!quiz.questions || quiz.questions.length === 0) && <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 block italic">This quiz currently has no questions.</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 py-4 text-center italic">No quizzes have been added to this course yet.</p>
            )}
            {isInstructorOwner && (
              <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                <Link to={ROUTES.CREATE_QUIZ.replace(':courseId', course.id.toString())}>
                  <Button variant="success" size="sm" className="flex items-center">
                    <PlusCircleIcon className="w-5 h-5 mr-2" /> Add New Quiz
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </main>

        <aside className="lg:col-span-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl sticky top-24 transition-colors duration-300 ease-in-out">
            <img src={course.imageUrl} alt={course.title} className="w-full h-56 object-cover rounded-md mb-6 shadow-md"/>
            {error && !enrollLoading && <p className="text-red-500 dark:text-red-400 text-sm mb-3 bg-red-100 dark:bg-red-900/30 p-2 rounded-md">{error}</p>}
            {isAuthenticated ? (
              isInstructorOwner ? (
                <div className="text-center text-blue-600 dark:text-blue-400 font-semibold py-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">You are the instructor.</div>
              ) : isEnrolled ? (
                <div className="text-center text-green-600 dark:text-green-400 font-semibold py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">You are enrolled!</div>
              ) : (
                <Button variant="success" className="w-full text-lg py-3" onClick={handleEnroll} disabled={enrollLoading}>
                  {enrollLoading ? <LoadingSpinner /> : 'Enroll Now'}
                </Button>
              )
            ) : (
              <Button variant="success" className="w-full text-lg py-3" onClick={() => navigate(ROUTES.LOGIN, { state: { from: location } } )}>
                Login to Enroll
              </Button>
            )}
            <div className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p><strong>Category:</strong> <span className="text-gray-600 dark:text-gray-400">{course.category}</span></p>
              <p><strong>Lessons:</strong> <span className="text-gray-600 dark:text-gray-400">{course.lessons?.length || 0}</span></p>
              <p><strong>Quizzes:</strong> <span className="text-gray-600 dark:text-gray-400">{quizzes.length}</span></p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CourseDetailPage;
