
import React, { useState, useEffect } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate, useParams, Link } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { useAuth } from '../hooks/useAuth';
import { mockApiService } from '../services/mockApiService';
import { generateQuizQuestionsWithGemini, isGeminiAvailable } from '../services/geminiService';
import { ROUTES } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { QuizQuestion, QuizQuestionOption, Course, UserRole } from '../types';
import { TrashIcon, SparklesIcon, PlusIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

interface CreationResult {
  success: boolean;
  message: string;
  quizId?: string;
  quizTitle?: string;
  courseId?: string;
}

const CreateQuizPage: React.FC = () => {
  const { user } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate(); // Updated for v6+

  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<Array<Partial<QuizQuestionOption>>>([{ text: '' }, { text: '' }]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const geminiReady = isGeminiAvailable();

  const [isLoading, setIsLoading] = useState(false); 
  const [pageLoading, setPageLoading] = useState(true); 
  const [formError, setFormError] = useState(''); 
  const [creationResult, setCreationResult] = useState<CreationResult | null>(null);

  useEffect(() => {
    if (!user || user.role !== UserRole.INSTRUCTOR) {
      navigate(ROUTES.LOGIN); // Updated for v6+
      return;
    }
    if (!courseId) {
        setFormError("Course ID is missing. Cannot create quiz.");
        setPageLoading(false);
        return;
    }
    const fetchCourse = async () => {
        setPageLoading(true);
        try {
            const fetchedCourse = await mockApiService.getCourseById(courseId);
            if (fetchedCourse && fetchedCourse.instructorId === user.id) {
                setCourse(fetchedCourse);
            } else {
                setFormError("Course not found or you are not authorized to add a quiz to it.");
            }
        } catch (err) {
            setFormError("Failed to load course details.");
            console.error(err);
        }
        setPageLoading(false);
    };
    fetchCourse();
  }, [user, courseId, navigate]);

  const handleAddOptionField = () => {
    if (currentOptions.length < 4) { 
        setCurrentOptions([...currentOptions, { text: '' }]);
    }
  };

  const handleRemoveOptionField = (index: number) => {
    if (currentOptions.length > 2) { 
        const newOptions = [...currentOptions]; newOptions.splice(index, 1); setCurrentOptions(newOptions);
        if (correctOptionIndex === index) setCorrectOptionIndex(null);
        else if (correctOptionIndex !== null && correctOptionIndex > index) setCorrectOptionIndex(correctOptionIndex - 1);
    }
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...currentOptions]; newOptions[index] = { ...newOptions[index], text }; setCurrentOptions(newOptions);
  };

  const handleAddQuestion = () => {
    setFormError('');
    if (!currentQuestionText.trim()) { setFormError('Question text is required.'); return; }
    const filledOptions = currentOptions.filter(opt => opt.text && opt.text.trim());
    if (filledOptions.length < 2) { setFormError('At least two options with text are required.'); return; }
    if (correctOptionIndex === null || !currentOptions[correctOptionIndex]?.text?.trim()) { setFormError('Please select a valid correct answer from the filled options.'); return; }

    let finalCorrectIndex = -1;
    const validOptionsWithOriginalIndex = currentOptions.map((opt, originalIndex) => ({ ...opt, originalIndex})).filter(opt => opt.text && opt.text.trim());
    const finalOptions: QuizQuestionOption[] = validOptionsWithOriginalIndex.map((opt, newIndex) => {
        if(opt.originalIndex === correctOptionIndex) finalCorrectIndex = newIndex;
        return { id: `opt_${Date.now()}_${opt.originalIndex}`, text: opt.text!.trim(), isCorrect: false };
    });
    if(finalCorrectIndex === -1) { setFormError("Error determining correct answer. Please re-select."); return; }
    finalOptions[finalCorrectIndex].isCorrect = true;

    const newQuestion: QuizQuestion = { id: `q_${Date.now()}`, text: currentQuestionText.trim(), options: finalOptions, type: 'mcq' };
    setQuestions([...questions, newQuestion]);
    setCurrentQuestionText(''); setCurrentOptions([{ text: '' }, { text: '' }]); setCorrectOptionIndex(null);
  };
  
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim()) { setAiError("Please enter a topic for AI question generation."); return; }
    if (!geminiReady) { setAiError("Gemini AI is not available. Please configure API_KEY."); return; }
    setIsGeneratingWithAI(true); setAiError('');
    try {
      const aiQuestions = await generateQuizQuestionsWithGemini(aiTopic, 3); 
      setQuestions(prev => [...prev, ...aiQuestions]); setAiTopic(''); 
    } catch (err) { setAiError(err instanceof Error ? err.message : "AI question generation failed."); console.error("AI Generation Error:", err); } 
    finally { setIsGeneratingWithAI(false); }
  };

  const handleRemoveQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!title.trim()) { setFormError('Quiz title is required.'); return; }
    if (questions.length === 0) { setFormError('At least one question is required for the quiz.'); return; }
    if (!courseId || !user) { setFormError('Course or user information is missing.'); return; }
    setIsLoading(true);
    try {
      const newQuiz = await mockApiService.createQuiz({ title: title.trim(), questions, courseId }, courseId);
      setCreationResult({ success: true, message: `Quiz "${newQuiz.title}" created successfully!`, quizId: newQuiz.id, quizTitle: newQuiz.title, courseId: newQuiz.courseId });
      setTitle(''); setQuestions([]); setAiTopic('');
    } catch (err) { console.error(err); setFormError('Failed to create quiz. Please try again.'); setCreationResult({ success: false, message: 'Failed to create quiz. Please try again.' }); } 
    finally { setIsLoading(false); }
  };

  if (pageLoading) {
    return <div className="container mx-auto px-4 py-8 text-center"><LoadingSpinner /><p className="dark:text-gray-300 mt-2">Loading course information...</p></div>;
  }
  
  if (!course && !pageLoading && formError) { 
      return (
        <div className="container mx-auto px-4 py-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-xl text-red-600 dark:text-red-400">{formError}</p>
            <Link to={ROUTES.INSTRUCTOR_DASHBOARD}> <Button variant="primary" className="mt-6">Back to Dashboard</Button> </Link>
        </div> );
  }
  if (!course) { 
      return <div className="container mx-auto px-4 py-8 text-center text-gray-600 dark:text-gray-300"><p>Could not load course information.</p></div>;
  }

  if (creationResult) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        {creationResult.success ? 
          <CheckCircleIcon className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" /> : 
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />}
        <h2 className={`text-2xl font-semibold mb-4 ${creationResult.success ? 'text-gray-800 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
          {creationResult.message}
        </h2>
        {creationResult.success && creationResult.quizId && creationResult.courseId && creationResult.quizTitle && (
          <div className="mt-6 space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
             <Link to={ROUTES.HOST_QUIZ_SESSION.replace(':courseId', creationResult.courseId).replace(':quizId', creationResult.quizId)}>
                <Button variant="success">Host "{creationResult.quizTitle}" Now</Button>
            </Link>
            <Button variant="primary" onClick={() => setCreationResult(null)}>Create Another Quiz for this Course</Button>
            <Link to={ROUTES.COURSE_DETAIL.replace(':courseId', creationResult.courseId)}>
              <Button variant="secondary">View Course Details</Button>
            </Link>
          </div>
        )}
        {!creationResult.success && <Button variant="primary" onClick={() => setCreationResult(null)}>Try Again</Button>}
      </div> );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">
            Create New Quiz for <Link to={ROUTES.COURSE_DETAIL.replace(':courseId', course.id)} className="text-blue-600 dark:text-blue-400 hover:underline">{course?.title}</Link>
        </h1>
        <Button variant="outline" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', course.id))}>
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Course
        </Button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 -mt-6">Add questions manually or use AI to generate them.</p>
      
      <form onSubmit={handleSubmitQuiz} className="bg-white dark:bg-gray-800 p-4 sm:p-8 rounded-xl shadow-2xl space-y-8 transition-colors duration-300 ease-in-out">
        <Input label="Quiz Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Chapter 1 Review" />

        {geminiReady && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-1">Generate Questions with AI ✨</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Powered by Gemini. Be specific for best results.</p>
            <div className="p-4 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-gray-700/50 space-y-3">
              <Input label="Topic for AI Questions" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g., Key Concepts of Photosynthesis" />
              <Button type="button" onClick={handleGenerateWithAI} disabled={isGeneratingWithAI || !aiTopic.trim()} variant="secondary" className="flex items-center">
                {isGeneratingWithAI ? <LoadingSpinner /> : <SparklesIcon className="w-5 h-5 mr-2"/>} Generate 3 Questions
              </Button>
              {aiError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{aiError}</p>}
            </div>
          </div>
        )}
        {!geminiReady && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-700/30 border border-yellow-300 dark:border-yellow-600 rounded-md text-sm text-yellow-700 dark:text-yellow-300">
                <ExclamationTriangleIcon className="w-5 h-5 inline mr-2 text-yellow-600 dark:text-yellow-400" />
                AI question generation unavailable. Check API key in <code>index.html</code>. Manual addition is still active.
            </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Add Question Manually</h2>
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-4">
                <Input label="Question Text" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} placeholder="Enter the question here" />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options (Mark correct answer)</label>
                {currentOptions.map((opt, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <Input type="text" placeholder={`Option ${index + 1}`} value={opt.text || ''} onChange={(e) => handleOptionTextChange(index, e.target.value)} className="flex-grow" />
                        <input type="radio" id={`correct_opt_create_${index}`} name="correctOptionCreate" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} className="form-radio h-5 w-5 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600" />
                         <label htmlFor={`correct_opt_create_${index}`} className="text-sm text-gray-600 dark:text-gray-300 select-none">Correct</label>
                        {currentOptions.length > 2 && <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveOptionField(index)} aria-label="Remove option"><TrashIcon className="w-4 h-4" /></Button>}
                    </div>
                ))}
                <div className="flex flex-wrap gap-2">
                    {currentOptions.length < 4 && <Button type="button" variant="secondary" size="sm" onClick={handleAddOptionField} className="flex items-center text-xs"><PlusIcon className="w-4 h-4 mr-1"/>Add Option Field</Button>}
                    <Button type="button" variant="primary" onClick={handleAddQuestion} className="flex items-center"><PlusIcon className="w-5 h-5 mr-1"/> Add This Question to Quiz</Button>
                </div>
            </div>
        </div>

        {questions.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Current Quiz Questions ({questions.length}):</h3>
            <ul className="space-y-3">
              {questions.map((q, index) => (
                <li key={q.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 shadow-sm hover:shadow-md dark:hover:bg-gray-700/70 transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm flex-1 pr-2">{index + 1}. {q.text}</p>
                    <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveQuestion(q.id)} aria-label="Remove question"><TrashIcon className="w-4 h-4"/></Button>
                  </div>
                  <ul className="list-disc list-inside ml-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {q.options.map(opt => ( <li key={opt.id} className={opt.isCorrect ? 'text-green-600 dark:text-green-400 font-semibold' : ''}> {opt.text} {opt.isCorrect && <CheckCircleIcon className="w-3 h-3 inline ml-1 text-green-500 dark:text-green-400" />}</li> ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {formError && <p className="text-red-600 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{formError}</p>}
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <Button type="submit" variant="success" className="w-full text-lg py-3" disabled={isLoading || questions.length === 0}>
            {isLoading ? <LoadingSpinner /> : 'Create Quiz'}
            </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuizPage;