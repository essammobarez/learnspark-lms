
import React, { useEffect, useState } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useParams, useNavigate } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { useAuth } from '../hooks/useAuth';
import { mockApiService } from '../services/mockApiService';
import { Quiz, ActiveQuizWithSession, UserRole } from '../types';
import { ROUTES, QUIZ_WITH_ACTIVE_PIN_KEY } from '../constants';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { ExclamationTriangleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';


const generatePin = (): string => Math.floor(100000 + Math.random() * 900000).toString();

const HostQuizSessionPage: React.FC = () => {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate(); // Updated for v6+
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== UserRole.INSTRUCTOR) { navigate(ROUTES.LOGIN); return; } // Updated for v6+
    if (!courseId || !quizId) { setError("Course or Quiz ID is missing."); setIsLoading(false); return; }
    const fetchQuizDetailsAndSetupSession = async () => {
      setIsLoading(true);
      try {
        const fetchedQuiz = await mockApiService.getQuizById(quizId);
        if (!fetchedQuiz || fetchedQuiz.courseId !== courseId) setError("Quiz not found or does not belong to this course.");
        else if (fetchedQuiz.questions.length === 0) setError("This quiz has no questions. Please add questions before hosting.");
        else {
          setQuiz(fetchedQuiz); const newPin = generatePin(); setPin(newPin);
          const sessionData: ActiveQuizWithSession = { pin: newPin, quizId: fetchedQuiz.id, courseId: fetchedQuiz.courseId, hostUserId: user.id, status: 'waiting', quizTitle: fetchedQuiz.title };
          localStorage.setItem(QUIZ_WITH_ACTIVE_PIN_KEY, JSON.stringify(sessionData));
        }
      } catch (e) { console.error("Error fetching quiz details:", e); setError("Failed to load quiz details."); }
      setIsLoading(false);
    };
    fetchQuizDetailsAndSetupSession();
    return () => {
        const storedSessionRaw = localStorage.getItem(QUIZ_WITH_ACTIVE_PIN_KEY);
        if (storedSessionRaw) {
            const storedSession = JSON.parse(storedSessionRaw) as ActiveQuizWithSession;
            if (storedSession.pin === pin && storedSession.status === 'waiting') localStorage.removeItem(QUIZ_WITH_ACTIVE_PIN_KEY);
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, quizId, user, navigate]);

  const handleStartQuizLobby = () => {
    if (!pin || !quiz) return;
    const storedSessionRaw = localStorage.getItem(QUIZ_WITH_ACTIVE_PIN_KEY);
    if (storedSessionRaw) {
        let session = JSON.parse(storedSessionRaw) as ActiveQuizWithSession;
        if (session.pin === pin) { session.status = 'active'; localStorage.setItem(QUIZ_WITH_ACTIVE_PIN_KEY, JSON.stringify(session));}
    }
    navigate(ROUTES.QUIZ.replace(':courseId', quiz.courseId).replace(':quizId', quiz.id)); // Updated for v6+
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
            <Button onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))} variant="secondary" className="flex items-center justify-center">
                <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Course
            </Button>
        </div>
      </div>
    );
  }

  if (!quiz || !pin) {
    return <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-gray-700 dark:text-gray-300">Waiting for session data...</div>;
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
        
        <p className="text-md text-gray-600 dark:text-gray-400 mb-6">Participants can join using the "Join QuizWith" link or by going to the join page directly.</p>
        
        <Button onClick={handleStartQuizLobby} variant="success" size="lg" className="w-full text-xl" disabled={quiz.questions.length === 0}>
          Open Quiz Lobby & Start
        </Button>
        {quiz.questions.length === 0 && <p className="text-red-500 dark:text-red-400 mt-2 text-sm">Cannot start: This quiz has no questions.</p>}

        <Button onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId!))} variant="secondary" className="mt-6 w-full flex items-center justify-center">
          <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Course Details
        </Button>
      </div>
    </div>
  );
};

export default HostQuizSessionPage;