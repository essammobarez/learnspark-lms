
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService'; 
import { Quiz, UserRole, ActiveQuizWithSession } from '../types'; // Added ActiveQuizWithSession
import { ROUTES } from '../constants';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const HostQuizSessionPage: React.FC = () => {
  const { courseId: courseIdParam, quizId: quizIdParam } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth(); // user.id is number

  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : null;
  const quizId = quizIdParam ? parseInt(quizIdParam, 10) : null;

  const [quiz, setQuiz] = useState<Quiz | null>(null); // quiz.id, quiz.courseId are numbers
  const [pin, setPin] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null); // sessionId is number
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setupSession = useCallback(async () => {
    if (!isAuthenticated || !user || user.role !== UserRole.INSTRUCTOR) {
      navigate(ROUTES.LOGIN);
      return;
    }
    if (!courseId || isNaN(courseId) || !quizId || isNaN(quizId)) {
      setError("Course or Quiz ID is missing or invalid.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedQuiz = await apiService.getQuizById(quizId);
      if (!fetchedQuiz) {
        setError("Quiz not found.");
      } else if (fetchedQuiz.courseId !== courseId) {
        setError("Quiz does not belong to this course.");
      } else if (!fetchedQuiz.questions || fetchedQuiz.questions.length === 0) {
        setError("This quiz has no questions. Please add questions before hosting.");
      } else {
        setQuiz(fetchedQuiz);
        const sessionResponse = await apiService.hostQuizWithSession(fetchedQuiz.id); // fetchedQuiz.id is number
        setPin(sessionResponse.pin);
        setSessionId(sessionResponse.sessionId); // sessionId is number
      }
    } catch (e) {
      console.error("Error setting up quiz session:", e);
      setError(e instanceof Error ? e.message : "Failed to set up quiz session.");
    }
    setIsLoading(false);
  }, [courseId, quizId, user, isAuthenticated, navigate]);

  useEffect(() => {
    setupSession();
  }, [setupSession]);


  const handleStartQuizLobby = () => {
    if (!pin || !quiz || !sessionId || !courseId) return;
    // Navigate to the quiz page for the host. Players join via PIN.
    // The host's participation in their own quiz might be handled differently or they just observe.
    // For now, let's assume host also "takes" the quiz UI.
    navigate(ROUTES.QUIZ.replace(':courseId', courseId.toString()).replace(':quizId', quiz.id.toString()));
  };

  if (isLoading) {
    return <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center"><LoadingSpinner /> <p className="mt-2 dark:text-gray-300">Setting up session...</p></div>;
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-md">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4"/>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Session Setup Error</h1>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
            <Button onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId?.toString() || ''))} variant="secondary" className="flex items-center justify-center">
                <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Course
            </Button>
        </div>
      </div>
    );
  }

  if (!quiz || !pin || !courseId) {
    return <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-gray-700 dark:text-gray-300">Waiting for session data... If this persists, there might be an issue.</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-900 text-white p-4 transition-all duration-300 ease-in-out">
      <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-8 md:p-12 rounded-xl shadow-2xl text-center max-w-xl transition-colors duration-300 ease-in-out">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Hosting QuizWith!</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">Quiz: <span className="font-semibold">{quiz.title}</span></p>
        
        <div className="mb-8">
          <p className="text-lg mb-2">Share this Game PIN with participants:</p>
          <div className="text-5xl sm:text-6xl font-bold text-purple-600 dark:text-purple-400 tracking-wider bg-gray-100 dark:bg-gray-700 p-4 rounded-lg inline-block shadow-inner">
            {pin}
          </div>
        </div>
        
        <p className="text-md text-gray-600 dark:text-gray-400 mb-6">Participants can join using the "Join QuizWith" link or by going to the join page directly. Waiting for players...</p>
        
        <Button onClick={handleStartQuizLobby} variant="success" size="lg" className="w-full text-xl">
          Open Quiz Lobby & Start Game
        </Button>

        <Button onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId.toString()))} variant="secondary" className="mt-6 w-full flex items-center justify-center">
          <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Course Details
        </Button>
      </div>
    </div>
  );
};

export default HostQuizSessionPage;
