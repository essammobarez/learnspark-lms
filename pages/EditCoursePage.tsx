
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService'; 
import { ROUTES } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Course, Lesson, UserRole } from '../types';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, PencilIcon } from '@heroicons/react/24/outline';


const EditCoursePage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const lessonFormRef = useRef<HTMLDivElement>(null);

  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]); 

  const [currentLessonTitle, setCurrentLessonTitle] = useState('');
  const [currentLessonType, setCurrentLessonType] = useState<'video' | 'document' | 'presentation'>('video');
  const [currentLessonContent, setCurrentLessonContent] = useState('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null); // To track lesson being edited

  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) {
      setError('Course ID not provided.');
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
          setLessons(fetchedCourse.lessons?.map(l => ({ ...l, id: l.id || `fetched_lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` })) || []);
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

  const resetLessonForm = () => {
    setCurrentLessonTitle('');
    setCurrentLessonType('video');
    setCurrentLessonContent('');
    setEditingLessonId(null);
    setError(''); // Clear minor lesson form errors
  };
  
  const handleStartEditLesson = (lessonId: string) => {
    const lessonToEdit = lessons.find(l => l.id === lessonId);
    if (lessonToEdit) {
      setEditingLessonId(lessonToEdit.id);
      setCurrentLessonTitle(lessonToEdit.title);
      setCurrentLessonType(lessonToEdit.type);
      setCurrentLessonContent(lessonToEdit.content);
      lessonFormRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddOrUpdateLesson = () => {
    if (!currentLessonTitle.trim() || !currentLessonContent.trim()) {
      setError("Lesson title and content are required.");
      return;
    }
    setError("");

    if (editingLessonId) {
      // Update existing lesson
      setLessons(lessons.map(l => 
        l.id === editingLessonId 
        ? { ...l, title: currentLessonTitle.trim(), type: currentLessonType, content: currentLessonContent.trim() } 
        : l
      ));
    } else {
      // Add new lesson
      const newLesson: Lesson = {
        id: `new_lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
        title: currentLessonTitle.trim(),
        type: currentLessonType,
        content: currentLessonContent.trim(),
      };
      setLessons([...lessons, newLesson]);
    }
    resetLessonForm();
  };

  const handleRemoveLesson = (lessonIdToRemove: string) => {
    setLessons(lessons.filter(lesson => lesson.id !== lessonIdToRemove));
    if (editingLessonId === lessonIdToRemove) { // If removing the lesson currently being edited
        resetLessonForm();
    }
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
      const lessonsToSubmit = lessons.map(l => ({
        title: l.title,
        type: l.type,
        content: l.content,
        id: l.id.startsWith('new_lesson_') || l.id.startsWith('fetched_lesson_') ? undefined : l.id
      }));

      const courseUpdateData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>> = {
        title, description, category,
        imageUrl: imageUrl || `https://picsum.photos/seed/${title.replace(/\s+/g, '-')}/600/400`,
        lessons: lessonsToSubmit as Lesson[], 
      };
      
      // FIX: Property 'updateCourse' now exists on apiService
      const updatedCourse = await apiService.updateCourse(courseId, courseUpdateData);
      setIsSubmitting(false);
      if (updatedCourse) {
        navigate(ROUTES.COURSE_DETAIL.replace(':courseId', updatedCourse.id));
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
    return <div className="container mx-auto p-6 text-center"><LoadingSpinner /><p className="text-gray-600 mt-2">Loading course for editing...</p></div>;
  }

  if (error && !course && !isLoading) { 
    return (
      <div className="container mx-auto p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 text-xl">{error}</p>
        <Button onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }
  
  if (!course && !isLoading) { 
    return <div className="container mx-auto p-6 text-center text-gray-600">Could not find the course to edit.</div>;
  }
  
  if (course && user && course.instructorId !== user.id && !isLoading) { 
     return (
      <div className="container mx-auto p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 text-xl">Authorization Error</p>
        <p className="text-gray-600 mt-2">You are not authorized to edit this course.</p>
        <Button onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Edit Course: <span className="text-blue-600">{course?.title}</span></h1>
         <Button variant="secondary" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))} disabled={isSubmitting}>
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Cancel Editing
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl space-y-6 transition-colors duration-300 ease-in-out">
        <Input label="Course Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-gray-900"
            required
          />
        </div>
        <Input label="Category (e.g., Development, Design)" value={category} onChange={(e) => setCategory(e.target.value)} required />
        <Input label="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Manage Lessons</h2>
          {lessons.length > 0 && (
            <div className="mb-6 space-y-3">
                <h3 className="text-md font-medium text-gray-700">Current Lessons ({lessons.length}):</h3>
                 <ul className="border border-gray-200 rounded-md shadow-sm divide-y divide-gray-200">
                    {lessons.map((l, index) => ( 
                        <li key={l.id || `lesson-item-${index}`} className="px-4 py-3 flex justify-between items-center text-sm hover:bg-gray-50 transition-colors">
                            <span className="text-gray-800 flex-1">{index + 1}. {l.title} <span className="text-xs text-gray-500">({l.type})</span></span>
                            <div className="flex space-x-2">
                                <Button type="button" variant="secondary" size="sm" onClick={() => handleStartEditLesson(l.id)} aria-label="Edit lesson" className="text-xs">
                                    <PencilIcon className="w-4 h-4 mr-1 inline"/>Edit
                                </Button>
                                <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveLesson(l.id)} aria-label="Remove lesson">
                                   <TrashIcon className="w-4 h-4"/>
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
          )}
          <div ref={lessonFormRef} className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium text-gray-700">{editingLessonId ? 'Edit Lesson Details' : 'Add New Lesson'}</h3>
            <Input label="Lesson Title" value={currentLessonTitle} onChange={(e) => setCurrentLessonTitle(e.target.value)} />
            <div>
                <label htmlFor="lessonTypeEdit" className="block text-sm font-medium text-gray-700 mb-1">Lesson Type</label>
                <select 
                    id="lessonTypeEdit" 
                    value={currentLessonType} 
                    onChange={(e) => setCurrentLessonType(e.target.value as 'video' | 'document' | 'presentation')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-gray-900"
                >
                    <option value="video">Video (URL)</option>
                    <option value="document">Document (Markdown/Text)</option>
                    <option value="presentation">Presentation (URL/Text)</option>
                </select>
            </div>
            <Input label="Lesson Content (URL or Text)" value={currentLessonContent} onChange={(e) => setCurrentLessonContent(e.target.value)} />
            <div className="flex space-x-3">
                <Button type="button" variant={editingLessonId ? "success" : "primary"} onClick={handleAddOrUpdateLesson} className="flex items-center">
                    <PlusIcon className="w-5 h-5 mr-2"/> {editingLessonId ? 'Save Lesson Changes' : 'Add Lesson to List'}
                </Button>
                {editingLessonId && (
                    <Button type="button" variant="outline" onClick={resetLessonForm}>
                        Cancel Edit
                    </Button>
                )}
            </div>
          </div>
        </div>

        {error && !isSubmitting && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-md">{error}</p>}
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