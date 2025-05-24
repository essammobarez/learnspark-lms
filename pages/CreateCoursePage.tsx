
import React, { useState } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { useAuth } from '../hooks/useAuth';
import { mockApiService } from '../services/mockApiService';
import { ROUTES } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Course, Lesson, UserRole } from '../types';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const CreateCoursePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); // Updated for v6+
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [lessons, setLessons] = useState<Array<Omit<Lesson, 'id'>>>([]);
  
  const [currentLessonTitle, setCurrentLessonTitle] = useState('');
  const [currentLessonType, setCurrentLessonType] = useState<'video' | 'document' | 'presentation'>('video');
  const [currentLessonContent, setCurrentLessonContent] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.role !== UserRole.INSTRUCTOR) {
    // This check is primarily for access control before submission.
    // A ProtectedRoute in App.tsx would handle initial redirection better.
    return (
       <div className="container mx-auto p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 dark:text-red-400 text-xl">Access Denied.</p>
        <p className="text-gray-600 dark:text-gray-300 mt-2">You must be an instructor to create a course.</p>
        <Button onClick={() => navigate(ROUTES.LOGIN)} className="mt-4">Login as Instructor</Button>
      </div>
    );
  }
  
  const handleAddLesson = () => {
    if (!currentLessonTitle.trim() || !currentLessonContent.trim()) {
        setError("Lesson title and content are required to add a lesson.");
        return;
    }
    setError(""); // Clear previous error
    setLessons([...lessons, { title: currentLessonTitle.trim(), type: currentLessonType, content: currentLessonContent.trim() }]);
    setCurrentLessonTitle('');
    setCurrentLessonContent('');
    // setCurrentLessonType('video'); // Optionally reset type
  };

  const handleRemoveLesson = (indexToRemove: number) => {
    setLessons(lessons.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== UserRole.INSTRUCTOR) { // Re-check auth just in case
      setError('Authentication error. Please login as an instructor.');
      return;
    }
    if (!title || !description || !category) {
      setError('Course Title, Description, and Category are required.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'> = {
        title,
        description,
        instructorId: user.id,
        imageUrl: imageUrl || `https://picsum.photos/seed/${title.replace(/\s+/g, '-')}/600/400`,
        lessons: lessons.map((l, index) => ({...l, id: `lesson_temp_${index}`})), // Temp IDs
        quizIds: [],
        category,
      };
      const newCourse = await mockApiService.createCourse(courseData, user);
      setIsLoading(false);
      navigate(ROUTES.COURSE_DETAIL.replace(':courseId', newCourse.id)); // Updated for v6+
    } catch (err) {
      setIsLoading(false);
      setError('Failed to create course. Please try again.');
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Create New Course</h1>
        <Button variant="secondary" onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)} className="mt-4 sm:mt-0">
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Dashboard
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl space-y-6 transition-colors duration-300 ease-in-out">
        <Input label="Course Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Ultimate Web Development Bootcamp"/>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300 ease-in-out"
            required
            placeholder="Describe your course in detail..."
          />
        </div>
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="e.g., Development, Design, Marketing" />
        <Input label="Image URL (Optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg or leave blank for default" />

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Add Lessons</h2>
          {lessons.length > 0 && (
            <div className="mb-6 space-y-3">
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">Added Lessons ({lessons.length}):</h3>
                <ul className="border border-gray-200 dark:border-gray-600 rounded-md shadow-sm divide-y divide-gray-200 dark:divide-gray-600">
                    {lessons.map((l, i) => (
                    <li key={i} className="px-4 py-3 flex justify-between items-center text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <span className="text-gray-800 dark:text-gray-200">{i+1}. {l.title} <span className="text-xs text-gray-500 dark:text-gray-400">({l.type})</span></span>
                        <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveLesson(i)} aria-label="Remove lesson">
                           <TrashIcon className="w-4 h-4"/>
                        </Button>
                    </li>
                    ))}
                </ul>
            </div>
          )}
          <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">New Lesson Details:</h3>
            <Input label="Lesson Title" value={currentLessonTitle} onChange={(e) => setCurrentLessonTitle(e.target.value)} placeholder="e.g., Introduction to HTML"/>
            <div>
                <label htmlFor="lessonType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lesson Type</label>
                <select 
                    id="lessonType" 
                    value={currentLessonType} 
                    onChange={(e) => setCurrentLessonType(e.target.value as 'video' | 'document' | 'presentation')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                    <option value="video">Video (URL)</option>
                    <option value="document">Document (Markdown/Text)</option>
                    <option value="presentation">Presentation (URL/Text)</option>
                </select>
            </div>
            <Input label="Lesson Content (URL or Text)" value={currentLessonContent} onChange={(e) => setCurrentLessonContent(e.target.value)} placeholder="e.g., https://youtube.com/watch?v=... or Markdown content"/>
            <Button type="button" variant="secondary" onClick={handleAddLesson} className="flex items-center">
                <PlusIcon className="w-5 h-5 mr-2" /> Add Lesson to List
            </Button>
          </div>
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
        <Button type="submit" variant="primary" className="w-full py-3 text-lg" disabled={isLoading}>
          {isLoading ? <LoadingSpinner /> : 'Create Course'}
        </Button>
      </form>
    </div>
  );
};

export default CreateCoursePage;