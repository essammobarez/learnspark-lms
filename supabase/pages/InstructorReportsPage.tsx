
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { QuizAttempt, Quiz, UserRole } from '../types';
import { apiService } from '../services/apiService'; // Use real API service
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import Button from '../components/Button';
import { TableCellsIcon, DocumentChartBarIcon, AcademicCapIcon, FunnelIcon, ArrowUturnLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const InstructorReportsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [instructorQuizzes, setInstructorQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('all'); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    if (user && isAuthenticated && user.role === UserRole.INSTRUCTOR) {
      setIsLoading(true); 
      setError(null);
      try {
        const [quizzes, attempts] = await Promise.all([
          apiService.getQuizzesForInstructor(), // Fetches quizzes for the current instructor
          apiService.getQuizAttemptsForInstructorQuizzes() // Fetches attempts for those quizzes
        ]);
        setInstructorQuizzes(quizzes);
        setQuizAttempts(attempts);
      } catch (e) { 
        console.error("Failed to fetch instructor reports data:", e); 
        setError(e instanceof Error ? e.message : "Could not load report data. Please try again later.");
      } finally { 
        setIsLoading(false); 
      }
    } else { 
      setIsLoading(false); 
      if (isAuthenticated && user?.role !== UserRole.INSTRUCTOR) {
        setError("Access Denied. You are not an instructor.");
      }
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const filteredAttempts = selectedQuizId === 'all' ? quizAttempts : quizAttempts.filter(attempt => attempt.quizId === selectedQuizId);

  if (isLoading) {
    return ( <div className="text-center py-10"><LoadingSpinner /> <p className="mt-3 text-gray-600 dark:text-gray-400">Loading quiz reports...</p></div> );
  }
  if (!isAuthenticated || !user || user.role !== UserRole.INSTRUCTOR) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl transition-colors duration-300 ease-in-out">
        <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
        <h2 className="mt-2 text-xl font-medium text-gray-900 dark:text-white">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error || "You must be an instructor to view these reports."}</p>
        <div className="mt-6"> <Link to={ROUTES.LOGIN}><Button variant="primary">Login as Instructor</Button></Link> </div>
      </div> );
  }
  if (error && !isLoading) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-400 dark:text-red-500 mb-4" />
        <h2 className="mt-2 text-xl font-medium text-red-700 dark:text-red-400">Error Loading Reports</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <div className="mt-6"> <Button variant="primary" onClick={fetchInitialData}>Try Again</Button> 
        </div>
      </div> );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Quiz Performance Reports</h1>
        <Link to={ROUTES.INSTRUCTOR_DASHBOARD}>
          <Button variant="secondary" className="mt-4 sm:mt-0 flex items-center">
             <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Dashboard
          </Button>
        </Link>
      </div>

      {instructorQuizzes.length > 0 && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <label htmlFor="quizFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <FunnelIcon className="w-5 h-5 inline mr-1 text-gray-500 dark:text-gray-400"/> Filter by Quiz:
          </label>
          <select id="quizFilter" name="quizFilter" value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)}
            className="mt-1 block w-full sm:w-auto pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option value="all">All My Quizzes</option>
            {instructorQuizzes.map(quiz => ( <option key={quiz.id} value={quiz.id}>{quiz.title}</option> ))}
          </select>
        </div>
      )}

      {filteredAttempts.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden transition-colors duration-300 ease-in-out">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Course</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Quiz</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Participant</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Percentage</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{attempt.courseTitle}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{attempt.quizTitle}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{attempt.playerNickname || attempt.userId || 'N/A'}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"> {attempt.score} / {attempt.totalQuestions} </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                       <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        attempt.percentage >= 70 ? 'bg-green-100 dark:bg-green-700/30 text-green-800 dark:text-green-300' : 
                        attempt.percentage >= 40 ? 'bg-yellow-100 dark:bg-yellow-700/30 text-yellow-800 dark:text-yellow-300' : 
                        'bg-red-100 dark:bg-red-700/30 text-red-800 dark:text-red-300' }`}>
                        {attempt.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"> {new Date(attempt.takenAt).toLocaleDateString()} </td>
                     <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {attempt.isQuizWith ? 
                            <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-700/30 text-purple-800 dark:text-purple-300 rounded-full">QuizWith</span> :
                            <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-700/30 text-blue-800 dark:text-blue-300 rounded-full">Course Quiz</span>
                        }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
          <TableCellsIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">No Quiz Attempts Found</h2>
          <p className="mt-2 text-md text-gray-600 dark:text-gray-400">
            {selectedQuizId === 'all' && instructorQuizzes.length > 0 ? "No students have taken any of your quizzes yet." : 
             selectedQuizId !== 'all' && instructorQuizzes.length > 0 ? "No attempts found for the selected quiz." :
             "You haven't created any quizzes, or no attempts have been made on them."}
          </p>
          <div className="mt-8"> <Link to={ROUTES.INSTRUCTOR_DASHBOARD}> <Button variant="primary" size="lg">Go to Dashboard</Button> </Link> </div>
        </div>
      )}
    </div>
  );
};

export default InstructorReportsPage;