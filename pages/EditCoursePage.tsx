
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import { ROUTES } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Course, Lesson, UserRole } from '../types';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';


const EditCoursePage: React.FC = () => {
  const { user, isAuthenticated } = useAuth(); // user.id is number
  const { courseId: courseIdParam } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : null;

  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]); 

  const [currentLessonTitle, setCurrentLessonTitle] = useState('');
  const [currentLessonType, setCurrentLessonType] = useState<'video' | 'document' | 'presentation'>('video');
  const [currentLessonContent, setCurrentLessonContent] = useState('');
  // const [currentLessonOrderIndex, setCurrentLessonOrderIndex] = useState(0); // For new lessons

  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId || isNaN(courseId)) {
      setError('Course ID not provided or invalid.');
      setIsLoading(false);
      navigate(ROUTES.INSTRUCTOR_DASHBOARD);
      return;
    }
    if (!isAuthenticated || !user || user.role !== UserRole.INSTRUCTOR) {
      navigate(ROUTES.LOGIN);
      return;
    }

    const fetchCourse = async () => {
      setIsLoading(true);
      setError('');
      try {
        const fetchedCourse = await apiService.getCourseById(courseId);
        if (fetchedCourse && fetchedCourse.instructorId === user.id) {
          setCourse(fetchedCourse);
          setTitle(fetchedCourse.title);
          setDescription(fetchedCourse.description);
          setCategory(fetchedCourse.category);
          setImageUrl(fetchedCourse.imageUrl);
          setLessons(fetchedCourse.lessons || []);
          // setCurrentLessonOrderIndex(fetchedCourse.lessons?.length || 0);
        } else if (fetchedCourse) {
          setError('You are not authorized to edit this course.');
          setCourse(null);
        } else {
          setError('Course not found.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, user, isAuthenticated, navigate]);

  const handleAddLesson = () => {
    if (!currentLessonTitle.trim() || !currentLessonContent.trim()) {
      setError("Lesson title and content are required to add a lesson.");
      return;
    }
    setError("");
    // New lessons don't have a DB ID yet. The backend will assign one.
    // A temporary client-side ID can be used for list rendering if needed, e.g., Date.now()
    // Or, the backend can return the full lesson object with its new ID.
    // For this structure, we send lessons without IDs if they are new.
    const newLesson: Lesson = {
      id: -Date.now(), // Negative temp ID for new, non-DB items for local list key
      title: currentLessonTitle.trim(),
      type: currentLessonType,
      content: currentLessonContent.trim(),
      orderIndex: lessons.length, // New lessons are added at the end
    };
    setLessons([...lessons, newLesson]);
    setCurrentLessonTitle('');
    setCurrentLessonContent('');
    // setCurrentLessonOrderIndex(lessons.length + 1);
  };

  const handleRemoveLesson = (lessonIdToRemove: number) => {
    setLessons(lessons.filter(lesson => lesson.id !== lessonIdToRemove).map((l, i) => ({...l, orderIndex:i})));
    // setCurrentLessonOrderIndex(lessons.length -1);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !category) {
      setError('Title, description, and category are required.');
      return;
    }
    if (!courseId || !course) {
        setError('Course data is missing. Cannot update.');
        return;
    }
    if (course.instructorId !== user?.id) {
        setError('You are not authorized to update this course.');
        return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      // Prepare lessons: existing lessons keep their IDs, new ones might not have one or have temp ID
      // Backend should handle creating new lessons if ID is missing/temp and updating existing ones.
      const lessonsToSend = lessons.map((l, index) => ({
        id: l.id > 0 ? l.id : undefined, // Send ID only if it's a persisted one
        title: l.title,
        type: l.type,
        content: l.content,
        orderIndex: l.orderIndex !== undefined ? l.orderIndex : index,
      }));

      const courseUpdateData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>> = {
        title, description, category,
        imageUrl: imageUrl || `https://picsum.photos/seed/${title.replace(/\s+/g, '-')}/600/400`,
        lessons: lessonsToSend as any, // Cast as backend expects array of Lesson-like objects
      };
      
      const updatedCourse = await apiService.updateCourse(courseId, courseUpdateData);
      setIsSubmitting(false);
      if (updatedCourse) {
        navigate(ROUTES.COURSE_DETAIL.replace(':courseId', updatedCourse.id.toString()));
      } else {
        setError('Failed to update course. Please try again.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to update course. An unexpected error occurred.');
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center"><LoadingSpinner /><p className="dark:text-gray-300 mt-2">Loading course for editing...</p></div>;
  }

  if (error && !course && !isLoading) { 
    return (
      <div className="container mx-auto p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 dark:text-red-400 text-xl">{error}</p>
        <Button onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }
  
  if (!course && !isLoading) { 
    return <div className="container mx-auto p-6 text-center text-gray-600 dark:text-gray-300">Could not find the course to edit.</div>;
  }
  
  if (course && user && course.instructorId !== user.id && !isLoading) { 
     return (
      <div className="container mx-auto p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 dark:text-red-400 text-xl">Authorization Error</p>
        <p className="text-gray-600 dark:text-gray-300 mt-2">You are not authorized to edit this course.</p>
        <Button onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Edit Course: <span className="text-blue-600 dark:text-blue-400">{course?.title}</span></h1>
         <Button variant="secondary" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId?.toString() || ''))} disabled={isSubmitting}>
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Cancel Editing
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl space-y-6 transition-colors duration-300 ease-in-out">
        <Input label="Course Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <Input label="Category (e.g., Development, Design)" value={category} onChange={(e) => setCategory(e.target.value)} required />
        <Input label="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Manage Lessons</h2>
          {lessons.length > 0 && (
            <div className="mb-6 space-y-3">
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">Current Lessons ({lessons.length}):</h3>
                 <ul className="border border-gray-200 dark:border-gray-600 rounded-md shadow-sm divide-y divide-gray-200 dark:divide-gray-600">
                    {lessons.map((l, index) => ( // Use index for key if ID can be temporary negative
                        <li key={l.id > 0 ? l.id : `temp-lesson-${index}`} className="px-4 py-3 flex justify-between items-center text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <span className="text-gray-800 dark:text-gray-200">{l.orderIndex !== undefined ? l.orderIndex + 1 : index + 1}. {l.title} <span className="text-xs text-gray-500 dark:text-gray-400">({l.type})</span></span>
                            <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveLesson(l.id)} aria-label="Remove lesson">
                               <TrashIcon className="w-4 h-4"/>
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
          )}
          <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">Add New Lesson</h3>
            <Input label="Lesson Title" value={currentLessonTitle} onChange={(e) => setCurrentLessonTitle(e.target.value)} />
            <div>
                <label htmlFor="lessonTypeEdit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lesson Type</label>
                <select 
                    id="lessonTypeEdit" 
                    value={currentLessonType} 
                    onChange={(e) => setCurrentLessonType(e.target.value as 'video' | 'document' | 'presentation')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                    <option value="video">Video (URL)</option>
                    <option value="document">Document (Markdown/Text)</option>
                    <option value="presentation">Presentation (URL/Text)</option>
                </select>
            </div>
            <Input label="Lesson Content (URL or Text)" value={currentLessonContent} onChange={(e) => setCurrentLessonContent(e.target.value)} />
            <Button type="button" variant="secondary" onClick={handleAddLesson} className="flex items-center">
                <PlusIcon className="w-5 h-5 mr-2"/> Add Lesson
            </Button>
          </div>
        </div>

        {error && !isSubmitting && <p className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
        <div className="pt-4">
            <Button type="submit" variant="primary" className="w-full py-3 text-lg" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner /> : 'Save Course Changes'}
            </Button>
        </div>
      </form>
    </div>
  );
};

export default EditCoursePage;
