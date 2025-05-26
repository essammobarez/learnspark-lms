
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Quiz, QuizWithPlayerInfo, QuizAttempt, QuizWithLiveAnswerPayload, QuizQuestion } from '../types'; 
import { apiService } from '../services/apiService'; 
import LoadingSpinner from '../components/LoadingSpinner';
import QuizQuestionUI from '../components/QuizQuestionUI';
import Button from '../components/Button';
import { ROUTES, QUIZ_WITH_PLAYER_INFO_KEY, APP_NAME } from '../constants'; 
import { useAuth } from '../hooks/useAuth'; 
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';
import { RealtimeChannel } from '@supabase/supabase-js';

interface QuizPageLocationState {
  isHostingQuizWith?: boolean;
  quizWithSessionId?: string;
  playerNickname?: string; // For students joining QuizWith
}

const QuizPage: React.FC = () => {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth(); 

  const routeState = location.state as QuizPageLocationState | null;
  const isHostingQuizWith = routeState?.isHostingQuizWith || false;
  const quizWithSessionIdFromState = routeState?.quizWithSessionId;
  const playerNicknameFromState = routeState?.playerNickname;


  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCurrentAnswerCorrect, setIsCurrentAnswerCorrect] = useState<boolean | undefined>(undefined);
  const [playerNicknameForDisplay, setPlayerNicknameForDisplay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30); 

  // Realtime states for host
  const [liveAnswerStats, setLiveAnswerStats] = useState<{ [optionId: string]: { count: number, nicknames: string[] } }>({});
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  // FIX: Use a ref to store the current question for the realtime handler
  const currentQuestionForRealtimeRef = useRef<QuizQuestion | undefined>(undefined);


  useEffect(() => {
    // FIX: Update the ref when the current question changes
    if (quiz && quiz.questions && quiz.questions[currentQuestionIndex]) {
      currentQuestionForRealtimeRef.current = quiz.questions[currentQuestionIndex];
    }
  }, [quiz, currentQuestionIndex]);

  // Effect for host to subscribe to live answers
  useEffect(() => {
    if (isHostingQuizWith && quizWithSessionIdFromState && quiz) {
      // Clear old stats for the new question
      setLiveAnswerStats({});

      const handleNewAnswer = (payload: QuizWithLiveAnswerPayload) => {
        // FIX: Use the ref for the current question in the closure
        const currentQ = currentQuestionForRealtimeRef.current;
        if (currentQ && payload.questionId === currentQ.id) {
          setLiveAnswerStats(prevStats => {
            const newStats = { ...prevStats };
            const optionStats = newStats[payload.selectedOptionId] || { count: 0, nicknames: [] };
            // Avoid double counting if a message is somehow re-processed for the same user
            if (!optionStats.nicknames.includes(payload.playerNickname)) {
                optionStats.count += 1;
                optionStats.nicknames.push(payload.playerNickname);
            }
            newStats[payload.selectedOptionId] = optionStats;
            return newStats;
          });
        }
      };
      realtimeChannelRef.current = apiService.subscribeToLiveAnswers(quizWithSessionIdFromState, handleNewAnswer);
      
      return () => {
        if (realtimeChannelRef.current) {
          apiService.unsubscribeFromLiveAnswers(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
      };
    }
  }, [isHostingQuizWith, quizWithSessionIdFromState, quiz, currentQuestionIndex]); // Re-subscribe if question changes, to reset stats logic implicitly
  
  useEffect(() => {
    if (playerNicknameFromState) {
      setPlayerNicknameForDisplay(playerNicknameFromState);
    } else {
      const storedPlayerInfo = localStorage.getItem(QUIZ_WITH_PLAYER_INFO_KEY);
      if (storedPlayerInfo) {
          const player = JSON.parse(storedPlayerInfo) as QuizWithPlayerInfo;
          setPlayerNicknameForDisplay(player.nickname);
      }
    }
  }, [playerNicknameFromState]);


  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) {
        setError("Quiz ID is missing.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const fetchedQuiz = await apiService.getQuizById(quizId);
        setQuiz(fetchedQuiz);
        if (fetchedQuiz && fetchedQuiz.questions.length > 0) {
          setTimeLeft(30); 
        } else if (!fetchedQuiz) {
          setError("Quiz not found.");
        } else if (fetchedQuiz.questions.length === 0) {
          setError("This quiz has no questions.");
        }
      } catch (e) {
        console.error("Failed to fetch quiz:", e);
        setError(e instanceof Error ? e.message : "Could not load the quiz.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (!quiz || isQuizFinished || isAnswered || !quiz.questions || quiz.questions.length === 0 || isLoading) return;
    if (timeLeft === 0 && !isAnswered) { 
      handleAnswerSelect(""); 
      return; 
    }
    const timer = setInterval(() => setTimeLeft((prevTime) => prevTime > 0 ? prevTime - 1 : 0), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, quiz, isQuizFinished, isAnswered, isLoading]);


  const handleAnswerSelect = async (optionId: string) => {
    if (!quiz || isAnswered) return;
    setSelectedOptionId(optionId);
    setIsAnswered(true);
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const selectedOpt = currentQuestion.options.find(opt => opt.id === optionId);
    let newScore = score;

    if (selectedOpt && selectedOpt.isCorrect) {
      newScore = score + 1;
      setScore(newScore);
      setIsCurrentAnswerCorrect(true);
    } else {
      setIsCurrentAnswerCorrect(false);
    }

    // Broadcast answer if student in QuizWith
    if (!isHostingQuizWith && playerNicknameForDisplay && quizWithSessionIdFromState && currentQuestion) {
        const payload: QuizWithLiveAnswerPayload = {
            type: 'ANSWER_SUBMITTED',
            quizId: quiz.id,
            questionId: currentQuestion.id,
            selectedOptionId: optionId, // Can be empty if timed out
            playerNickname: playerNicknameForDisplay,
        };
        try {
            await apiService.broadcastStudentAnswer(quizWithSessionIdFromState, payload);
        } catch (broadcastError) {
            console.error("Failed to broadcast answer:", broadcastError);
            // Optionally notify user of broadcast failure, but don't block local quiz flow
        }
    }


    // Submit score after the last question for non-hosts or if host is also playing
    // For hosts, their score isn't typically submitted in QuizWith.
    if (!isHostingQuizWith && currentQuestionIndex >= quiz.questions.length - 1) {
       if (quiz && courseId) {
        try {
            const attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle'> = {
                userId: isAuthenticated && user ? user.id : undefined,
                playerNickname: playerNicknameForDisplay || undefined, 
                quizId: quiz.id, 
                quizTitle: quiz.title, 
                courseId: courseId,
                score: newScore, 
                totalQuestions: quiz.questions.length,
                isQuizWith: !!playerNicknameForDisplay, 
            };
            await apiService.submitQuizScore(attemptData);
            if(playerNicknameForDisplay) localStorage.removeItem(QUIZ_WITH_PLAYER_INFO_KEY);
        } catch (apiError) {
            console.error("Failed to submit quiz score:", apiError);
        }
      }
    }

    setTimeout(() => {
      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex(prevIndex => prevIndex + 1);
        setIsAnswered(false); setSelectedOptionId(undefined); setIsCurrentAnswerCorrect(undefined); setTimeLeft(30); 
        if(isHostingQuizWith) setLiveAnswerStats({}); // Reset stats for new question on host side
      } else {
        setIsQuizFinished(true);
      }
    }, 2500); 
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 p-4 transition-colors duration-300 ease-in-out">
        <LoadingSpinner /> <p className="text-white mt-4 text-lg">Loading Quiz...</p>
      </div> );
  }
  if (error || !quiz || (quiz && (!quiz.questions || quiz.questions.length === 0))) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-800 p-4 text-white transition-colors duration-300 ease-in-out">
        <ExclamationTriangleIcon className="w-16 h-16 text-yellow-400 mb-4" />
        <h1 className="text-3xl font-bold mb-4">{error || "Quiz Not Found or Empty"}</h1>
        <p className="mb-6 text-lg text-gray-300">This quiz is currently unavailable.</p>
        <Button onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))} variant="secondary">
          Back to Course
        </Button>
      </div> );
  }
  if (isQuizFinished) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-700 p-4 text-white transition-all duration-300 ease-in-out">
        <div className="bg-white bg-opacity-20 backdrop-blur-md p-8 rounded-xl shadow-2xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-6 animate-pulse">Quiz Finished!</h1>
            {playerNicknameForDisplay && <p className="text-2xl mb-2">Well done, {playerNicknameForDisplay}!</p>}
            {!playerNicknameForDisplay && user && !isHostingQuizWith && <p className="text-2xl mb-2">Well done, {user.username.split(' ')[0]}!</p>}
            {isHostingQuizWith && <p className="text-2xl mb-2">The QuizWith session has ended.</p>}

            {/* Score display for players, not typically for hosts in this summary view */}
            {!isHostingQuizWith && (
              <p className="text-3xl mb-8">Your Score: <span className="font-extrabold text-yellow-300">{score}</span> / {quiz.questions.length}</p>
            )}
            
            <div className="space-y-3 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center">
                <Button variant="primary" size="lg" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId!))} className="flex items-center justify-center">
                  <HomeIcon className="w-5 h-5 mr-2"/> Back to Course
                </Button>
                {!isHostingQuizWith && (
                  <Button variant="secondary" size="lg" onClick={() => { 
                      setCurrentQuestionIndex(0); setScore(0); setIsQuizFinished(false); setIsAnswered(false);
                      setSelectedOptionId(undefined); setTimeLeft(30); setError(null);
                      if(isHostingQuizWith) setLiveAnswerStats({});
                  }} className="flex items-center justify-center">
                    <ArrowPathIcon className="w-5 h-5 mr-2"/> Try Again
                  </Button>
                )}
            </div>
        </div>
      </div> );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  if (!currentQuestion) {
    // This case should ideally not be reached if quiz loading and indexing are correct.
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-800 p-4 text-white">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-2xl">Error: Question not found.</h1>
        <Button onClick={() => navigate(ROUTES.HOME)} variant="primary" className="mt-4">Go Home</Button>
      </div>
    );
  }
  const timePercentage = (timeLeft / 30) * 100;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-between bg-gray-800 p-2 sm:p-4 overflow-y-auto transition-colors duration-300 ease-in-out">
      <header className="w-full max-w-3xl mx-auto text-white p-3 sm:p-4 rounded-t-lg bg-black/30 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-lg sm:text-xl font-bold truncate" title={quiz.title}>{quiz.title} {isHostingQuizWith && "(Hosting)"}</h1>
          {!isHostingQuizWith && <div className="text-md sm:text-lg font-semibold whitespace-nowrap">Score: {score}</div>}
        </div>
        <div className="flex justify-between items-center text-sm sm:text-base">
          <div>Question {currentQuestionIndex + 1} of {quiz.questions.length}</div>
           {playerNicknameForDisplay && !isHostingQuizWith && <div className="text-xs text-gray-400 hidden sm:block">Playing as: {playerNicknameForDisplay}</div>}
          <div className="text-lg sm:text-xl font-bold bg-white text-gray-900 px-3 py-1 rounded-full shadow-lg">{timeLeft}s</div>
        </div>
         <div className="w-full bg-gray-600 rounded-full h-2.5 sm:h-3 mt-3 sm:mt-4 overflow-hidden shadow-inner">
            <div 
                className={`h-full rounded-full transition-all duration-1000 ease-linear
                            ${timePercentage > 60 ? 'bg-green-500' : 
                             timePercentage > 30 ? 'bg-yellow-500' : 
                             'bg-red-500'}`}
                style={{ width: `${timePercentage}%` }}>
            </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center w-full my-4 px-2">
        <QuizQuestionUI 
          question={currentQuestion} 
          onAnswerSelect={handleAnswerSelect} 
          selectedOptionId={selectedOptionId} 
          isAnswered={isAnswered} 
          isCorrect={isCurrentAnswerCorrect}
          liveAnswerStats={isHostingQuizWith ? liveAnswerStats : undefined}
        />
      </main>
      
      <footer className="w-full p-2 sm:p-4 text-center text-gray-400 text-xs">
        {APP_NAME} - Interactive Quiz Mode
      </footer>
    </div>
  );
};

export default QuizPage;