
import React, { useState } from 'react';
// Fix: Changed react-router-dom imports from v5 to v6+ style.
// Confirmed react-router-dom import syntax for v6+.
import { useNavigate } from 'react-router-dom'; // Updated for v6+: useNavigate instead of useHistory
import { ROUTES, QUIZ_WITH_ACTIVE_PIN_KEY, QUIZ_WITH_PLAYER_INFO_KEY } from '../constants';
import { ActiveQuizWithSession, QuizWithPlayerInfo } from '../types';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const JoinQuizWithPage: React.FC = () => {
  const navigate = useNavigate(); // Updated for v6+
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!pin.trim() || !nickname.trim()) { setError('Game PIN and Nickname are required.'); return; }
    setIsLoading(true);
    setTimeout(() => { 
      const storedSessionRaw = localStorage.getItem(QUIZ_WITH_ACTIVE_PIN_KEY);
      if (storedSessionRaw) {
        const activeSession = JSON.parse(storedSessionRaw) as ActiveQuizWithSession;
        if (activeSession.pin === pin.trim().toUpperCase() && (activeSession.status === 'waiting' || activeSession.status === 'active')) {
          const playerInfo: QuizWithPlayerInfo = { nickname: nickname.trim(), joinedPin: pin.trim().toUpperCase() };
          localStorage.setItem(QUIZ_WITH_PLAYER_INFO_KEY, JSON.stringify(playerInfo));
          if (activeSession.status === 'active') {
            navigate(ROUTES.QUIZ.replace(':courseId', activeSession.courseId).replace(':quizId', activeSession.quizId)); // Updated for v6+
          } else if (activeSession.status === 'waiting') {
             alert("Waiting for the host to start the quiz. You'll be redirected. (This would be a dynamic lobby screen in a real app)");
            navigate(ROUTES.QUIZ.replace(':courseId', activeSession.courseId).replace(':quizId', activeSession.quizId)); // Updated for v6+
          } else setError('This QuizWith session is no longer active.');
        } else setError('Invalid Game PIN or session not found.');
      } else setError('No active QuizWith session found for this PIN.');
      setIsLoading(false);
    }, 500); 
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-br from-green-400 via-teal-500 to-blue-500 dark:from-green-700 dark:via-teal-800 dark:to-blue-900 p-4 transition-all duration-300 ease-in-out">
      <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-xl shadow-2xl w-full max-w-md text-center transition-colors duration-300 ease-in-out">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-8">Join QuizWith!</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Game PIN" id="pin" name="pin" type="text" value={pin}
            onChange={(e) => setPin(e.target.value.toUpperCase())} 
            placeholder="Enter 6-digit PIN" required maxLength={6}
            className="text-center text-2xl tracking-widest dark:bg-gray-700"
          />
          <Input
            label="Nickname" id="nickname" name="nickname" type="text" value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname" required maxLength={20}
            className="text-center dark:bg-gray-700"
          />
          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
          <div>
            <Button type="submit" variant="primary" className="w-full text-lg py-3" disabled={isLoading}>
              {isLoading ? <LoadingSpinner /> : 'Join Game'}
            </Button>
          </div>
        </form>
        <Button onClick={() => navigate(ROUTES.HOME)} variant="secondary" className="mt-6 w-full flex items-center justify-center" disabled={isLoading}>
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Go Back
        </Button>
      </div>
      <p className="text-white text-opacity-80 text-sm mt-8">
        Get the Game PIN from the host.
      </p>
    </div>
  );
};

export default JoinQuizWithPage;