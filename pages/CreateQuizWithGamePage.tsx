
import React, { useState, useEffect } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate, Link } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { useAuth } from '../hooks/useAuth';
import { mockApiService } from '../services/mockApiService';
import { generateQuizQuestionsWithGemini, isGeminiAvailable } from '../services/geminiService';
import { ROUTES, QUIZ_WITH_ACTIVE_PIN_KEY } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { QuizQuestion, QuizQuestionOption, Course, ActiveQuizWithSession, UserRole } from '../types';
import { TrashIcon, SparklesIcon, PlusIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const generatePin = (): string => Math.floor(100000 + Math.random() * 900000).toString();

const CreateQuizWithGamePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); // Updated for v6+

  const [instructorCourses, setInstructorCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<Array<Partial<QuizQuestionOption>>>([{ text: '' }, { text: '' }]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const geminiReady = isGeminiAvailable();

  const [pageLoading, setPageLoading] = useState(true); 
  const [formSubmitting, setFormSubmitting] = useState(false); 
  const [error, setError] = useState('');

  const [pageStep, setPageStep] = useState<'create_content' | 'show_pin'>('create_content');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [createdQuizDetails, setCreatedQuizDetails] = useState<{quizId: string, courseId: string, quizTitle: string} | null>(null);

  useEffect(() => {
    if (!user || user.role !== UserRole.INSTRUCTOR) { navigate(ROUTES.LOGIN); return; } // Updated for v6+
    const fetchInstructorCourses = async () => {
      setPageLoading(true);
      try {
        const courses = await mockApiService.getCreatedCourses(user.id);
        setInstructorCourses(courses);
        if (courses.length > 0) setSelectedCourseId(courses[0].id);
        else setError("Create a course first to associate your QuizWith game.");
      } catch (err) { setError("Failed to load your courses."); console.error(err); }
      setPageLoading(false);
    };
    fetchInstructorCourses();
  }, [user, navigate]);

  const handleAddOptionField = () => { if (currentOptions.length < 4) setCurrentOptions([...currentOptions, { text: '' }]); };
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
    setError('');
    if (!currentQuestionText.trim()) { setError('Question text is required.'); return; }
    const filledOptions = currentOptions.filter(opt => opt.text && opt.text.trim());
    if (filledOptions.length < 2) { setError('At least two options with text are required.'); return; }
    if (correctOptionIndex === null || !currentOptions[correctOptionIndex]?.text?.trim()) { setError('Please select a valid correct answer from the filled options.'); return; }
    let finalCorrectIndex = -1;
    const validOptionsWithOriginalIndex = currentOptions.map((opt, originalIndex) => ({ ...opt, originalIndex})).filter(opt => opt.text && opt.text.trim());
    const finalOptions: QuizQuestionOption[] = validOptionsWithOriginalIndex.map((opt, newIndex) => {
        if(opt.originalIndex === correctOptionIndex) finalCorrectIndex = newIndex;
        return { id: `opt_${Date.now()}_${opt.originalIndex}`, text: opt.text!.trim(), isCorrect: false };
    });
    if(finalCorrectIndex === -1) { setError("Error determining correct answer. Please re-select."); return; }
    finalOptions[finalCorrectIndex].isCorrect = true;
    const newQuestion: QuizQuestion = { id: `q_${Date.now()}`, text: currentQuestionText.trim(), options: finalOptions, type: 'mcq' };
    setQuestions([...questions, newQuestion]);
    setCurrentQuestionText(''); setCurrentOptions([{ text: '' }, { text: '' }]); setCorrectOptionIndex(null);
  };
  const handleGenerateWithAI = async () => {
    if (!aiTopic) { setAiError("Please enter a topic."); return; }
    if (!geminiReady) { setAiError("Gemini AI is not available."); return; }
    setIsGeneratingWithAI(true); setAiError('');
    try {
      const aiQuestions = await generateQuizQuestionsWithGemini(aiTopic, 3); 
      setQuestions(prev => [...prev, ...aiQuestions]); setAiTopic('');
    } catch (err) { setAiError(err instanceof Error ? err.message : "AI question generation failed."); } 
    finally { setIsGeneratingWithAI(false); }
  };
  const handleSubmitQuizContent = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!selectedCourseId) { setError('Please select a course.'); return; }
    if (!quizTitle || questions.length === 0) { setError('Quiz title and at least one question are required.'); return; }
    if (!user) { setError('User not found.'); return; }
    setFormSubmitting(true);
    try {
      const newQuiz = await mockApiService.createQuiz({ title: quizTitle, questions, courseId: selectedCourseId }, selectedCourseId);
      const pin = generatePin();
      const sessionData: ActiveQuizWithSession = { pin, quizId: newQuiz.id, courseId: newQuiz.courseId, hostUserId: user.id, status: 'waiting', quizTitle: newQuiz.title };
      localStorage.setItem(QUIZ_WITH_ACTIVE_PIN_KEY, JSON.stringify(sessionData));
      setGeneratedPin(pin); setCreatedQuizDetails({ quizId: newQuiz.id, courseId: newQuiz.courseId, quizTitle: newQuiz.title });
      setPageStep('show_pin');
    } catch (err) { setError('Failed to create QuizWith game.'); console.error(err); } 
    finally { setFormSubmitting(false); }
  };
  const handleOpenLobbyAndStart = () => {
    if (!generatedPin || !createdQuizDetails) return;
    const storedSessionRaw = localStorage.getItem(QUIZ_WITH_ACTIVE_PIN_KEY);
    if (storedSessionRaw) {
        let session = JSON.parse(storedSessionRaw) as ActiveQuizWithSession;
        if (session.pin === generatedPin) { session.status = 'active'; localStorage.setItem(QUIZ_WITH_ACTIVE_PIN_KEY, JSON.stringify(session)); }
    }
    navigate(ROUTES.QUIZ.replace(':courseId', createdQuizDetails.courseId).replace(':quizId', createdQuizDetails.quizId)); // Updated for v6+
  };
  const resetAndCreateAnother = () => {
    setQuizTitle(''); setQuestions([]); setCurrentQuestionText(''); setCurrentOptions([{ text: '' }, { text: '' }]);
    setCorrectOptionIndex(null); setAiTopic(''); setAiError(''); setError('');
    setGeneratedPin(null); setCreatedQuizDetails(null); setPageStep('create_content');
  };

  if (pageLoading) {
    return <div className="container mx-auto p-6 text-center"><LoadingSpinner /><p className="dark:text-gray-300 mt-2">Loading your courses...</p></div>;
  }
  if (instructorCourses.length === 0 && !pageLoading) {
    return (
      <div className="container mx-auto p-6 text-center bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" />
        <p className="text-xl text-gray-700 dark:text-gray-200 mb-4">{error || "You need to create a course before creating a QuizWith game."}</p>
        <Link to={ROUTES.CREATE_COURSE}> <Button variant="primary">Create a Course Now</Button> </Link>
      </div> );
  }

  if (pageStep === 'show_pin' && generatedPin && createdQuizDetails) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center bg-gradient-to-tr from-green-500 via-teal-500 to-cyan-500 dark:from-green-700 dark:via-teal-800 dark:to-cyan-900 text-white p-4 transition-all duration-300 ease-in-out">
        <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-8 md:p-12 rounded-xl shadow-2xl text-center max-w-xl transition-colors duration-300 ease-in-out">
          <CheckCircleIcon className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">QuizWith Game Ready!</h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">Game: <span className="font-semibold">{createdQuizDetails.quizTitle}</span></p>
          <div className="mb-8">
            <p className="text-lg mb-2">Share this Game PIN:</p>
            <div className="text-5xl sm:text-6xl font-bold text-teal-600 dark:text-teal-400 tracking-wider bg-gray-100 dark:bg-gray-700 p-4 rounded-lg inline-block shadow-inner">
              {generatedPin}
            </div>
          </div>
          <Button onClick={handleOpenLobbyAndStart} variant="success" size="lg" className="w-full text-xl mb-4"> Open Lobby & Start Game </Button>
          <Button onClick={resetAndCreateAnother} variant="secondary" className="w-full mb-4"> Create Another QuizWith Game </Button>
          <Button onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)} variant="outline" className="w-full"> Back to Dashboard </Button>
        </div>
      </div> );
  }

  return (
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Create New QuizWith Game</h1>
        <Button variant="outline" onClick={() => navigate(ROUTES.INSTRUCTOR_DASHBOARD)}>
             <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Dashboard
        </Button>
      </div>
      <form onSubmit={handleSubmitQuizContent} className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-xl shadow-2xl space-y-6 transition-colors duration-300 ease-in-out">
        <div>
          <label htmlFor="courseSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Course for this Game</label>
          <select id="courseSelect" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required disabled={instructorCourses.length === 0} >
            {instructorCourses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </div>
        <Input label="QuizWith Game Title" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} required placeholder="e.g., Fun Friday Trivia"/>
        
        {geminiReady && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Generate Questions with AI ✨</h2>
              <div className="p-4 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-gray-700/50 space-y-3">
                  <Input label="Topic for AI Questions" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g., World Capitals"/>
                  <Button type="button" onClick={handleGenerateWithAI} disabled={isGeneratingWithAI || !aiTopic} variant="secondary" className="flex items-center">
                      {isGeneratingWithAI ? <LoadingSpinner /> : <SparklesIcon className="w-5 h-5 mr-2"/>} Generate 3 Questions
                  </Button>
                  {aiError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{aiError}</p>}
              </div>
          </div>
        )}
        {!geminiReady && (
           <div className="p-3 bg-yellow-50 dark:bg-yellow-700/30 border border-yellow-300 dark:border-yellow-600 rounded-md text-sm text-yellow-700 dark:text-yellow-300">
              AI question generation unavailable. Check API key. Manual addition still works.
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Add Questions Manually</h2>
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-4">
            <Input label="Question Text" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} />
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options (Mark correct)</label>
            {currentOptions.map((opt, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input type="text" placeholder={`Opt ${index + 1}`} value={opt.text || ''} onChange={(e) => handleOptionTextChange(index, e.target.value)} className="flex-grow"/>
                <input type="radio" id={`correct_opt_create_qw_${index}`} name="correctOption_create_qw" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} 
                    className="form-radio h-5 w-5 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600"/>
                <label htmlFor={`correct_opt_create_qw_${index}`} className="text-sm text-gray-600 dark:text-gray-300">Correct</label>
                {currentOptions.length > 2 && <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveOptionField(index)}><TrashIcon className="w-4 h-4" /></Button>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
                {currentOptions.length < 4 && <Button type="button" variant="secondary" size="sm" onClick={handleAddOptionField} className="flex items-center text-xs"><PlusIcon className="w-4 h-4 mr-1"/>Add Option Field</Button>}
                <Button type="button" variant="primary" onClick={handleAddQuestion} className="mt-2 flex items-center"><PlusIcon className="w-5 h-5 mr-1"/>Add This Question</Button>
            </div>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Current Questions ({questions.length}):</h3>
            <ul className="space-y-3">
              {questions.map((q, index) => (
                <li key={q.id} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 shadow-sm text-sm">
                  <p className="font-medium text-gray-800 dark:text-gray-100">{index + 1}. {q.text}</p>
                  <ul className="list-disc list-inside ml-4 text-gray-600 dark:text-gray-400">
                    {q.options.map(opt => <li key={opt.id} className={opt.isCorrect ? 'text-green-600 dark:text-green-400 font-semibold' : ''}>{opt.text} {opt.isCorrect && "(Correct)"}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
        <Button type="submit" variant="success" className="w-full text-lg py-3" disabled={formSubmitting || instructorCourses.length === 0 || questions.length === 0}>
          {formSubmitting ? <LoadingSpinner /> : 'Create QuizWith & Get PIN'}
        </Button>
      </form>
    </div>
  );
};

export default CreateQuizWithGamePage;