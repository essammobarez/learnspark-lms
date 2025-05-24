
import React, { useEffect, useState } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useParams, useNavigate } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { Quiz, QuizQuestion, QuizQuestionOption, QuizWithPlayerInfo } from '../types'; 
import { mockApiService } from '../services/mockApiService';
import LoadingSpinner from '../components/LoadingSpinner';
import QuizQuestionUI from '../components/QuizQuestionUI';
import Button from '../components/Button';
// Fix: Import APP_NAME from constants.
import { ROUTES, QUIZ_WITH_PLAYER_INFO_KEY, APP_NAME } from '../constants'; 
import { useAuth } from '../hooks/useAuth'; 
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';

const QuizPage: React.FC = () => {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate(); // Updated for v6+
  const { user, isAuthenticated } = useAuth(); 

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCurrentAnswerCorrect, setIsCurrentAnswerCorrect] = useState<boolean | undefined>(undefined);
  const [playerNickname, setPlayerNickname] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState(30); 

  useEffect(() => {
    const storedPlayerInfo = localStorage.getItem(QUIZ_WITH_PLAYER_INFO_KEY);
    if (storedPlayerInfo) {
        const player = JSON.parse(storedPlayerInfo) as QuizWithPlayerInfo;
        setPlayerNickname(player.nickname);
    }
  }, []);


  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) return;
      setIsLoading(true);
      const fetchedQuiz = await mockApiService.getQuizById(quizId);
      setQuiz(fetchedQuiz);
      setIsLoading(false);
      if (fetchedQuiz && fetchedQuiz.questions.length > 0) {
        setTimeLeft(30); 
      }
    };
    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (!quiz || isQuizFinished || isAnswered || quiz.questions.length === 0 || isLoading) return;
    if (timeLeft === 0) { handleAnswerSelect(""); return; }
    const timer = setInterval(() => setTimeLeft((prevTime) => prevTime - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, quiz, isQuizFinished, isAnswered, isLoading]);


  const handleAnswerSelect = (optionId: string) => {
    if (!quiz || isAnswered) return;
    setSelectedOptionId(optionId);
    setIsAnswered(true);
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const selectedOpt = currentQuestion.options.find(opt => opt.id === optionId);
    let currentScore = score;
    if (selectedOpt && selectedOpt.isCorrect) {
      currentScore = score + 1;
      setScore(currentScore);
      setIsCurrentAnswerCorrect(true);
    } else {
      setIsCurrentAnswerCorrect(false);
    }

    setTimeout(() => {
      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex(prevIndex => prevIndex + 1);
        setIsAnswered(false); setSelectedOptionId(undefined); setIsCurrentAnswerCorrect(undefined); setTimeLeft(30); 
      } else {
        setIsQuizFinished(true);
        if (quiz && courseId) {
          mockApiService.submitQuizScore({
            userId: isAuthenticated && user ? user.id : undefined,
            playerNickname: playerNickname || undefined, 
            quizId: quiz.id, quizTitle: quiz.title, courseId: courseId,
            score: currentScore, // Use the score calculated in this handler
            totalQuestions: quiz.questions.length,
            isQuizWith: !!playerNickname, 
          }).then(() => { if(playerNickname) localStorage.removeItem(QUIZ_WITH_PLAYER_INFO_KEY); })
            .catch(error => console.error("Failed to submit quiz score:", error));
        }
      }
    }, 2500); 
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 dark:bg-black p-4 transition-colors duration-300 ease-in-out">
        <LoadingSpinner /> <p className="text-white mt-4 text-lg">Loading Quiz...</p>
      </div> );
  }
  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-800 dark:bg-gray-900 p-4 text-white transition-colors duration-300 ease-in-out">
        <ExclamationTriangleIcon className="w-16 h-16 text-yellow-400 dark:text-yellow-500 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Quiz Not Found or Empty</h1>
        <p className="mb-6 text-lg text-gray-300 dark:text-gray-400">This quiz is currently unavailable or has no questions.</p>
        <Button onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))} variant="secondary">
          Back to Course
        </Button>
      </div> );
  }
  if (isQuizFinished) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-700 dark:from-purple-800 dark:via-indigo-700 dark:to-blue-800 p-4 text-white transition-all duration-300 ease-in-out">
        <div className="bg-white dark:bg-gray-800 bg-opacity-20 dark:bg-opacity-50 backdrop-blur-md p-8 rounded-xl shadow-2xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-6 animate-pulse">Quiz Finished!</h1>
            {playerNickname && <p className="text-2xl mb-2">Well done, {playerNickname}!</p>}
            {!playerNickname && user && <p className="text-2xl mb-2">Well done, {user.username.split(' ')[0]}!</p>}
            <p className="text-3xl mb-8">Your Score: <span className="font-extrabold text-yellow-300">{score}</span> / {quiz.questions.length}</p>
            <div className="space-y-3 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center">
                <Button variant="primary" size="lg" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId!))} className="flex items-center justify-center">
                  <HomeIcon className="w-5 h-5 mr-2"/> Back to Course
                </Button>
                <Button variant="secondary" size="lg" onClick={() => { 
                    setCurrentQuestionIndex(0); setScore(0); setIsQuizFinished(false); setIsAnswered(false);
                    setSelectedOptionId(undefined); setTimeLeft(30);
                }} className="flex items-center justify-center">
                  <ArrowPathIcon className="w-5 h-5 mr-2"/> Try Again
                </Button>
            </div>
        </div>
      </div> );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const timePercentage = (timeLeft / 30) * 100;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-between bg-gray-800 dark:bg-gray-900 p-2 sm:p-4 overflow-y-auto transition-colors duration-300 ease-in-out">
      <header className="w-full max-w-3xl mx-auto text-white p-3 sm:p-4 rounded-t-lg bg-black/30 dark:bg-black/50 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-lg sm:text-xl font-bold truncate" title={quiz.title}>{quiz.title}</h1>
          <div className="text-md sm:text-lg font-semibold whitespace-nowrap">Score: {score}</div>
        </div>
        <div className="flex justify-between items-center text-sm sm:text-base">
          <div>Question {currentQuestionIndex + 1} of {quiz.questions.length}</div>
           {playerNickname && <div className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Playing as: {playerNickname}</div>}
          <div className="text-lg sm:text-xl font-bold bg-white text-gray-900 dark:bg-gray-200 dark:text-black px-3 py-1 rounded-full shadow-lg">{timeLeft}s</div>
        </div>
         <div className="w-full bg-gray-600 dark:bg-gray-700 rounded-full h-2.5 sm:h-3 mt-3 sm:mt-4 overflow-hidden shadow-inner">
            <div 
                className={`h-full rounded-full transition-all duration-1000 ease-linear
                            ${timePercentage > 60 ? 'bg-green-500 dark:bg-green-400' : 
                             timePercentage > 30 ? 'bg-yellow-500 dark:bg-yellow-400' : 
                             'bg-red-500 dark:bg-red-400'}`}
                style={{ width: `${timePercentage}%` }}>
            </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center w-full my-4 px-2">
        <QuizQuestionUI question={currentQuestion} onAnswerSelect={handleAnswerSelect} selectedOptionId={selectedOptionId} isAnswered={isAnswered} isCorrect={isCurrentAnswerCorrect} />
      </main>
      
      <footer className="w-full p-2 sm:p-4 text-center text-gray-400 dark:text-gray-500 text-xs">
        {APP_NAME} - Interactive Quiz Mode
      </footer>
    </div>
  );
};

export default QuizPage;