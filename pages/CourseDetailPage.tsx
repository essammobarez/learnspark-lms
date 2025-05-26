
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
// FIX: Added User and QuizQuestion to import
import { Course, Lesson, Quiz, UserRole, UserCourseRating, CourseRating, User, QuizQuestion } from '../types';
import { apiService } from '../services/apiService'; 
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants';
import { PlayCircleIcon, DocumentTextIcon, PresentationChartBarIcon, PuzzlePieceIcon, PlusCircleIcon, VideoCameraIcon, PencilSquareIcon, PresentationChartLineIcon, StarIcon as StarSolidIcon, UserGroupIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/solid';
import { AcademicCapIcon, ExclamationTriangleIcon, StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';

const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actualEnrollmentCount, setActualEnrollmentCount] = useState<number | null>(null);

  // State for reviews and ratings
  const [allRatings, setAllRatings] = useState<UserCourseRating[]>([]);
  const [userRating, setUserRating] = useState<CourseRating | null>(null);
  const [newRatingStars, setNewRatingStars] = useState<number>(0);
  const [newReviewText, setNewReviewText] = useState<string>('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [enrolledStudentsList, setEnrolledStudentsList] = useState<User[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);


  const fetchCourseData = useCallback(async () => {
    if (!courseId) {
      setError("Course ID not provided.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setRatingError(null);
    setStudentsError(null);
    try {
      const fetchedCourse = await apiService.getCourseById(courseId);
      setCourse(fetchedCourse);

      if (fetchedCourse) {
        const promises: Promise<any>[] = [
          apiService.getQuizzesForCourse(courseId),
          apiService.getCourseRatingsWithUserDetails(courseId),
          apiService.getEnrollmentCountForCourse(courseId)
        ];
        
        if (user && isAuthenticated) {
          promises.push(apiService.getUserCourseRating(courseId, user.id));
          promises.push(apiService.getEnrolledCourses());
          if (fetchedCourse.instructorId === user.id) {
            setStudentsLoading(true);
            promises.push(apiService.getEnrolledStudentsForCourse(courseId));
          }
        }

        const results = await Promise.allSettled(promises);

        // FIX: Check status before accessing value or reason for Promise.allSettled results
        if (results[0].status === 'fulfilled') setQuizzes(results[0].value || []);
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        // FIX: Property 'value' does not exist on type 'PromiseRejectedResult'.
        else { console.error("Failed to fetch quizzes:", results[0].status === 'rejected' ? (results[0] as PromiseRejectedResult).reason : 'Unknown error'); setQuizzes([]); }
        
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        if (results[1].status === 'fulfilled') setAllRatings(results[1].value || []);
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        // FIX: Property 'reason' does not exist on type 'PromiseFulfilledResult<any>'.
        else { console.error("Failed to fetch all ratings:", results[1].status === 'rejected' ? (results[1] as PromiseRejectedResult).reason : 'Unknown error'); setAllRatings([]); }

        // FIX: Check status before accessing value or reason for Promise.allSettled results
        if (results[2].status === 'fulfilled') setActualEnrollmentCount(results[2].value);
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        // FIX: Check status before accessing value or reason for Promise.allSettled results
        // FIX: Property 'value' does not exist on type 'PromiseRejectedResult'.
        else { console.error("Failed to fetch enrollment count:", results[2].status === 'rejected' ? (results[2] as PromiseRejectedResult).reason : 'Unknown error'); setActualEnrollmentCount(0); }

        let userRatingResultIndex = 3;
        if (user && isAuthenticated) {
            // FIX: Check status before accessing value or reason for Promise.allSettled results
            if (results[userRatingResultIndex].status === 'fulfilled') {
                // FIX: Check status before accessing value or reason for Promise.allSettled results
                // FIX: Property 'value' does not exist on type 'PromiseRejectedResult'.
                const fetchedUserRating = (results[userRatingResultIndex] as PromiseFulfilledResult<CourseRating | null>).value;
                setUserRating(fetchedUserRating);
                if (fetchedUserRating) {
                    setNewRatingStars(fetchedUserRating.rating);
                    setNewReviewText(fetchedUserRating.reviewText || '');
                } else {
                    setNewRatingStars(0); setNewReviewText('');
                }
            // FIX: Check status before accessing value or reason for Promise.allSettled results
            } else {
                // FIX: Check status before accessing value or reason for Promise.allSettled results
                // FIX: Check status before accessing value or reason for Promise.allSettled results
                // FIX: Property 'reason' does not exist on type 'PromiseFulfilledResult<any>'.
                console.error("Failed to fetch user rating:", results[userRatingResultIndex].status === 'rejected' ? (results[userRatingResultIndex] as PromiseRejectedResult).reason : 'Unknown error');
                setNewRatingStars(0); setNewReviewText('');
            }
            userRatingResultIndex++;

            // FIX: Check status before accessing value or reason for Promise.allSettled results
            if (results[userRatingResultIndex].status === 'fulfilled') {
                // FIX: Check status before accessing value or reason for Promise.allSettled results
                // FIX: Property 'value' does not exist on type 'PromiseRejectedResult'.
                const enrolledCourses = (results[userRatingResultIndex] as PromiseFulfilledResult<Course[]>).value;
                setIsEnrolled(enrolledCourses.some((c: Course) => c.id === fetchedCourse.id));
            // FIX: Check status before accessing value or reason for Promise.allSettled results
            } else {
                // FIX: Check status before accessing value or reason for Promise.allSettled results
                console.error("Failed to fetch enrolled courses by user:", results[userRatingResultIndex].status === 'rejected' ? (results[userRatingResultIndex] as PromiseRejectedResult).reason : 'Unknown error');
                setIsEnrolled(false);
            }
            userRatingResultIndex++;
            
            if (fetchedCourse.instructorId === user.id && results[userRatingResultIndex]) {
                 // FIX: Check status before accessing value or reason for Promise.allSettled results
                 if (results[userRatingResultIndex].status === 'fulfilled') {
                    // FIX: Check status before accessing value or reason for Promise.allSettled results
                    // FIX: Property 'value' does not exist on type 'PromiseRejectedResult'.
                    setEnrolledStudentsList((results[userRatingResultIndex] as PromiseFulfilledResult<User[]>).value || []);
                 // FIX: Check status before accessing value or reason for Promise.allSettled results
                 } else {
                    // FIX: Check status before accessing value or reason for Promise.allSettled results
                    // FIX: Check status before accessing value or reason for Promise.allSettled results
                    // FIX: Property 'reason' does not exist on type 'PromiseFulfilledResult<any>'.
                    console.error("Failed to fetch enrolled students list:", results[userRatingResultIndex].status === 'rejected' ? (results[userRatingResultIndex] as PromiseRejectedResult).reason : 'Unknown error');
                    setStudentsError("Could not load student list.");
                    setEnrolledStudentsList([]);
                 }
                 setStudentsLoading(false);
            }

        } else {
          setIsEnrolled(false);
          setNewRatingStars(0); setNewReviewText('');
        }

      } else {
        setError("Course not found.");
      }
    } catch (e) {
      console.error("Failed to fetch course details or ratings:", e);
      setError(e instanceof Error ? e.message : "An error occurred while fetching course details.");
      setCourse(null); 
    } finally {
      setIsLoading(false);
      setStudentsLoading(false);
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
        await fetchCourseData(); 
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
  
  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !user || newRatingStars === 0) {
      setRatingError("Please select a star rating (1-5 stars).");
      return;
    }
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      await apiService.submitCourseRating(courseId, newRatingStars, newReviewText);
      await fetchCourseData(); 
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : "Failed to submit rating.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const getLessonIcon = (type: Lesson['type']) => {
    switch (type) {
      case 'video': return <PlayCircleIcon className="w-6 h-6 mr-3 text-blue-500 flex-shrink-0" />;
      case 'document': return <DocumentTextIcon className="w-6 h-6 mr-3 text-green-500 flex-shrink-0" />;
      case 'presentation': return <PresentationChartBarIcon className="w-6 h-6 mr-3 text-purple-500 flex-shrink-0" />;
      default: return <AcademicCapIcon className="w-6 h-6 mr-3 text-gray-400 flex-shrink-0" />; 
    }
  };

  const StarRatingDisplay: React.FC<{ rating: number, size?: string }> = ({ rating, size = "h-5 w-5" }) => (
    <div className="flex items-center">
        {[...Array(5)].map((_, index) => {
            const starValue = index + 1;
            return starValue <= Math.round(rating) ? 
                   <StarSolidIcon key={index} className={`${size} text-yellow-400`} /> : 
                   <StarOutlineIcon key={index} className={`${size} text-yellow-400`} />;
        })}
    </div>
  );
  
  const StarRatingInput: React.FC<{ count: number, value: number, onChange: (value: number) => void, size?: string, interactive?: boolean }> = 
    ({ count, value, onChange, size = "h-8 w-8", interactive = true }) => {
    const [hoverValue, setHoverValue] = useState<number | undefined>(undefined);
    const stars = Array(count).fill(0);

    const handleClick = (newValue: number) => {
      if (interactive) onChange(newValue);
    };
    const handleMouseOver = (newHoverValue: number) => {
      if (interactive) setHoverValue(newHoverValue);
    };
    const handleMouseLeave = () => {
      if (interactive) setHoverValue(undefined);
    };

    return (
      <div className="flex items-center">
        {stars.map((_, index) => {
          const ratingValue = index + 1;
          return (
            <button
              type="button"
              key={index}
              className={`focus:outline-none ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => handleClick(ratingValue)}
              onMouseOver={() => handleMouseOver(ratingValue)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive}
              aria-label={`Rate ${ratingValue} out of ${count} stars`}
            >
              {(hoverValue || value) >= ratingValue ? (
                <StarSolidIcon className={`${size} text-yellow-400`} />
              ) : (
                <StarOutlineIcon className={`${size} text-yellow-400`} />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-10"><LoadingSpinner /><p className="mt-3 text-gray-600">Loading course details...</p></div>;
  }

  if (error && !course) { 
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-md transition-colors duration-300 ease-in-out">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-semibold text-red-700">{error || "Course Not Found"}</h2>
        <p className="mt-2 text-md text-gray-600">We couldn't load the details for this course. It might have been removed or the link is incorrect.</p>
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
        <p className="mt-2 text-lg text-gray-600">Course data is not available.</p>
        <Link to={ROUTES.COURSE_LIST}><Button variant="primary" className="mt-4">Go to Courses</Button></Link>
      </div>
    );
  }

  const isInstructorOwner = isAuthenticated && user?.role === UserRole.INSTRUCTOR && user.id === course.instructorId;
  const placeholderImageUrl = `https://via.placeholder.com/800x450.png?text=${encodeURIComponent(course.title || 'Course Details')}`;
  const displayImageUrl = course.imageUrl || placeholderImageUrl;
  const sidebarImageUrl = course.imageUrl || `https://via.placeholder.com/600x400.png?text=${encodeURIComponent(course.title || 'Course')}`;
  
  const displayEnrollmentCount = (actualEnrollmentCount !== null ? actualEnrollmentCount : course?.enrollmentCount) ?? 0;
  const displayRating = course?.rating ?? 0;
  const ratingsCount = allRatings.length;

  return (
    <div className="bg-gray-100 min-h-screen transition-colors duration-300 ease-in-out">
      <header 
        className="bg-cover bg-center bg-no-repeat py-16 md:py-24 shadow-lg relative"
        style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${displayImageUrl})` }}
        role="banner"
        aria-labelledby="course-title"
      >
        <img 
            src={displayImageUrl} 
            alt={`Background for ${course.title}`} 
            className="absolute inset-0 w-full h-full object-cover -z-10" 
            onError={(e) => {
              if ((e.target as HTMLImageElement).src !== placeholderImageUrl) {
                (e.target as HTMLImageElement).src = placeholderImageUrl;
                if ((e.target as HTMLImageElement).parentElement) {
                    ((e.target as HTMLImageElement).parentElement as HTMLElement).style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${placeholderImageUrl})`;
                }
              }
            }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white relative z-10">
          <h1 id="course-title" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">{course.title}</h1>
          <p className="text-lg sm:text-xl text-gray-200 mb-5 max-w-3xl mx-auto">{course.description}</p>
          <p className="text-sm text-gray-300 mb-2">Created by <span className="font-semibold text-gray-100">{course.instructorName}</span></p>
          <div className="flex items-center justify-center text-sm text-yellow-300 mb-6">
            <StarSolidIcon className="w-5 h-5 text-yellow-300 mr-1" />
            <span>
              {displayRating.toFixed(1)} rating ({ratingsCount} rating{ratingsCount === 1 ? '' : 's'}, {displayEnrollmentCount.toLocaleString()} student{displayEnrollmentCount === 1 ? '' : 's'})
            </span>
            <span className="mx-2 text-gray-400">|</span>
            <span className="text-gray-200">{course.category}</span>
          </div>
           <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {isInstructorOwner && (
              <>
                <Link to={ROUTES.LIVE_SESSION.replace(':courseId', course.id)}>
                  <Button variant="primary" size="md" className="flex items-center bg-opacity-80 hover:bg-opacity-100">
                    <VideoCameraIcon className="w-5 h-5 mr-2" /> Start Live Session
                  </Button>
                </Link>
                <Link to={ROUTES.EDIT_COURSE.replace(':courseId', course.id)}>
                  <Button variant="secondary" size="md" className="flex items-center bg-opacity-80 hover:bg-opacity-100">
                    <PencilSquareIcon className="w-5 h-5 mr-2" /> Edit Course
                  </Button>
                </Link>
              </>
            )}
            {isAuthenticated && user?.role === UserRole.STUDENT && isEnrolled && (
               <Link to={ROUTES.LIVE_SESSION.replace(':courseId', course.id)}>
                <Button variant="success" size="md" className="flex items-center bg-opacity-80 hover:bg-opacity-100">
                  <UserGroupIcon className="w-5 h-5 mr-2" /> Join Live Session
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-8">
        <main className="lg:col-span-8 bg-white p-6 rounded-lg shadow-xl space-y-8 transition-colors duration-300 ease-in-out">
          {error && !enrollLoading && <p className="text-red-500 text-sm mb-4 bg-red-100 p-3 rounded-md">{error}</p>}
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Course Content</h2>
            {course.lessons && course.lessons.length > 0 ? (
              <ul className="space-y-4">
                {course.lessons.map((lesson, index) => (
                  <li key={lesson.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-200 flex items-center">
                    {getLessonIcon(lesson.type)}
                    <div>
                      <span className="text-lg text-gray-800 font-medium">{index + 1}. {lesson.title}</span>
                      <p className="text-sm text-gray-500 capitalize">{lesson.type} - Content: {lesson.content.substring(0,50)}{lesson.content.length > 50 ? "..." : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 py-4 text-center italic">No lessons available yet for this course.</p>
            )}
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-800 mt-10 mb-4">Quizzes</h3>
            {quizzes.length > 0 ? (
              <ul className="space-y-4">
                {quizzes.map(quiz => {
                  const questionCount = (quiz.questions as any)?.count ?? (quiz.questions as QuizQuestion[])?.length ?? 0;
                  const hasQuestions = questionCount > 0;

                  return (
                    <li key={quiz.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="flex items-center mb-2 sm:mb-0">
                          <PuzzlePieceIcon className="w-6 h-6 mr-3 text-indigo-500 flex-shrink-0" />
                          <span className="text-lg text-gray-800 font-medium">{quiz.title}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                            {(isEnrolled || isInstructorOwner) && hasQuestions && (
                                <Link to={ROUTES.QUIZ.replace(':courseId', course.id).replace(':quizId', quiz.id)} className="w-full sm:w-auto">
                                <Button variant="secondary" size="sm" className="w-full">Start Quiz</Button>
                                </Link>
                            )}
                             {isInstructorOwner && (
                                <Link to={ROUTES.EDIT_QUIZ.replace(':courseId', course.id).replace(':quizId', quiz.id)} className="w-full sm:w-auto">
                                  <Button variant="outline" size="sm" className="w-full flex items-center justify-center">
                                    <PencilSquareIcon className="w-4 h-4 mr-1" /> Edit Quiz
                                  </Button>
                                </Link>
                            )}
                            {isInstructorOwner && hasQuestions && (
                                <Link to={ROUTES.HOST_QUIZ_SESSION.replace(':courseId', course.id).replace(':quizId', quiz.id)} className="w-full sm:w-auto">
                                    <Button variant="primary" size="sm" className="w-full flex items-center justify-center">
                                        <PresentationChartLineIcon className="w-4 h-4 mr-1" /> Host QuizWith
                                    </Button>
                                </Link>
                            )}
                        </div>
                      </div>
                      {!hasQuestions && <span className="text-sm text-gray-500 mt-2 block italic">This quiz currently has no questions. Add some via "Edit Quiz".</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-600 py-4 text-center italic">No quizzes have been added to this course yet.</p>
            )}
            {isInstructorOwner && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <Link to={ROUTES.CREATE_QUIZ.replace(':courseId', course.id)}>
                  <Button variant="success" size="sm" className="flex items-center">
                    <PlusCircleIcon className="w-5 h-5 mr-2" /> Add New Quiz
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Enrolled Students Section (Instructor View) */}
          {isInstructorOwner && (
            <div className="mt-10 border-t border-gray-200 pt-8">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <UserGroupIcon className="w-7 h-7 mr-2 text-blue-500" /> Enrolled Students ({enrolledStudentsList.length})
              </h3>
              {studentsLoading && <LoadingSpinner />}
              {studentsError && <p className="text-red-500">{studentsError}</p>}
              {!studentsLoading && !studentsError && enrolledStudentsList.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {enrolledStudentsList.map(student => (
                    <li key={student.id} className="py-3">
                      <p className="text-sm font-medium text-gray-900">{student.username || "N/A"}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                !studentsLoading && !studentsError && <p className="text-gray-600 italic">No students enrolled yet.</p>
              )}
            </div>
          )}
          
          {/* Course Rating and Reviews Section */}
          <div className="mt-10 border-t border-gray-200 pt-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <ChatBubbleLeftEllipsisIcon className="w-7 h-7 mr-2 text-blue-500" /> Course Reviews & Ratings
            </h3>

            {/* Submit Rating Form */}
            {isAuthenticated && isEnrolled && user?.role === UserRole.STUDENT && (
              <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow">
                <h4 className="text-xl font-medium text-gray-700 mb-3">
                  {userRating ? "Your Review" : "Rate this Course"}
                </h4>
                <form onSubmit={handleRatingSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Rating:</label>
                    <StarRatingInput count={5} value={newRatingStars} onChange={setNewRatingStars} interactive={true} />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="reviewText" className="block text-sm font-medium text-gray-700 mb-1">Your Review (optional):</label>
                    <textarea
                      id="reviewText"
                      rows={4}
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="Share your thoughts about this course..."
                      disabled={ratingSubmitting}
                      aria-label="Your review text"
                    />
                  </div>
                  {ratingError && <p className="text-red-500 text-sm mb-3">{ratingError}</p>}
                   <Button type="submit" variant="primary" disabled={ratingSubmitting || newRatingStars === 0}>
                      {ratingSubmitting ? <LoadingSpinner /> : (userRating ? 'Update Review' : 'Submit Review')}
                   </Button>
                </form>
              </div>
            )}

            {/* Display Existing Reviews */}
            {allRatings.length > 0 ? (
              <div className="space-y-6">
                {allRatings.map(rating => (
                  <div key={rating.id} className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center mb-2">
                      <StarRatingDisplay rating={rating.rating} />
                      <span className="ml-2 text-sm text-gray-800 font-semibold">{rating.username || 'Anonymous User'}</span>
                      <span className="ml-auto text-xs text-gray-500">{new Date(rating.createdAt).toLocaleDateString()}</span>
                    </div>
                    {rating.reviewText && <p className="text-gray-700 text-sm">{rating.reviewText}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 italic">No reviews yet for this course. {isEnrolled && "Be the first to leave one!"}</p>
            )}
          </div>

        </main>

        <aside className="lg:col-span-4">
          <div className="bg-white p-6 rounded-lg shadow-xl sticky top-24 transition-colors duration-300 ease-in-out">
            <img 
                src={sidebarImageUrl} 
                alt={course.title} 
                className="w-full h-56 object-cover rounded-md mb-6 shadow-md"
                onError={(e) => {
                  if ((e.target as HTMLImageElement).src !== `https://via.placeholder.com/600x400.png?text=${encodeURIComponent(course.title || 'Course')}`) {
                    (e.target as HTMLImageElement).src = `https://via.placeholder.com/600x400.png?text=${encodeURIComponent(course.title || 'Course')}`;
                  }
                }}
            />
            {error && !enrollLoading && <p className="text-red-500 text-sm mb-3 bg-red-100 p-2 rounded-md">{error}</p>}
            {isAuthenticated ? (
              isInstructorOwner ? (
                <div className="text-center text-blue-600 font-semibold py-3 bg-blue-50 border border-blue-200 rounded-md">You are the instructor.</div>
              ) : isEnrolled ? (
                <div className="text-center text-green-600 font-semibold py-3 bg-green-50 border border-green-200 rounded-md">You are enrolled!</div>
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
            <div className="mt-6 space-y-3 text-sm text-gray-700">
              <p><strong>Category:</strong> <span className="text-gray-600">{course.category}</span></p>
              <p><strong>Lessons:</strong> <span className="text-gray-600">{course.lessons?.length || 0}</span></p>
              <p><strong>Quizzes:</strong> <span className="text-gray-600">{quizzes.length}</span></p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CourseDetailPage;