
import React, { useState, useEffect } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate, useParams } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { useAuth } from '../hooks/useAuth';
import { mockApiService } from '../services/mockApiService';
import { ROUTES } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Course, Lesson, UserRole } from '../types';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';


const EditCoursePage: React.FC = () => {
  const { user } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate(); // Updated for v6+

  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]); 

  const [currentLessonTitle, setCurrentLessonTitle] = useState('');
  const [currentLessonType, setCurrentLessonType] = useState<'video' | 'document' | 'presentation'>('video');
  const [currentLessonContent, setCurrentLessonContent] = useState('');

  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) {
      setError('Course ID not provided.');
      setIsLoading(false);
      navigate(ROUTES.INSTRUCTOR_DASHBOARD); // Updated for v6+
      return;
    }
    if (!user || user.role !== UserRole.INSTRUCTOR) {
      navigate(ROUTES.LOGIN); // Updated for v6+
      return;
    }

    const fetchCourse = async () => {
      setIsLoading(true);
      try {
        const fetchedCourse = await mockApiService.getCourseById(courseId);
        if (fetchedCourse && fetchedCourse.instructorId === user.id) {
          setCourse(fetchedCourse);
          setTitle(fetchedCourse.title);
          setDescription(fetchedCourse.description);
          setCategory(fetchedCourse.category);
          setImageUrl(fetchedCourse.imageUrl);
          setLessons(fetchedCourse.lessons || []);
        } else {
          setError('Course not found or you are not authorized to edit it.');
          // navigate(ROUTES.INSTRUCTOR_DASHBOARD); // Optionally navigate away
        }
      } catch (err) {
        setError('Failed to load course data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, user, navigate]);

  const handleAddLesson = () => {
    if (!currentLessonTitle.trim() || !currentLessonContent.trim()) {
      setError("Lesson title and content are required to add a lesson.");
      return;
    }
    setError("");
    const newLesson: Lesson = {
      id: `new_lesson_${Date.now()}`, // Temporary ID
      title: currentLessonTitle.trim(),
      type: currentLessonType,
      content: currentLessonContent.trim(),
    };
    setLessons([...lessons, newLesson]);
    setCurrentLessonTitle('');
    setCurrentLessonContent('');
  };

  const handleRemoveLesson = (lessonIdToRemove: string) => {
    setLessons(lessons.filter(lesson => lesson.id !== lessonIdToRemove));
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

    setIsSubmitting(true);
    setError('');
    try {
      const courseUpdateData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>> = {
        title, description, category,
        imageUrl: imageUrl || `https://picsum.photos/seed/${title.replace(/\s+/g, '-')}/600/400`,
        lessons: lessons, 
      };
      
      const updatedCourse = await mockApiService.updateCourse(courseId, courseUpdateData);
      setIsSubmitting(false);
      if (updatedCourse) {
        navigate(ROUTES.COURSE_DETAIL.replace(':courseId', updatedCourse.id)); // Updated for v6+
      } else {
        setError('Failed to update course. Please try again.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setError('Failed to update course. An unexpected error occurred.');
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-6 text-center"><LoadingSpinner /><p className="dark:text-gray-300 mt-2">Loading course for editing...</p></div>;
  }

  if (error && !course) { 
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
  
  if (!course) { 
    return <div className="container mx-auto p-6 text-center text-gray-600 dark:text-gray-300">Could not find the course to edit.</div>;
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Edit Course: <span className="text-blue-600 dark:text-blue-400">{course.title}</span></h1>
         <Button variant="secondary" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))} disabled={isSubmitting}>
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
                    {lessons.map((l) => (
                        <li key={l.id} className="px-4 py-3 flex justify-between items-center text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <span className="text-gray-800 dark:text-gray-200">{l.title} <span className="text-xs text-gray-500 dark:text-gray-400">({l.type})</span></span>
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

        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
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