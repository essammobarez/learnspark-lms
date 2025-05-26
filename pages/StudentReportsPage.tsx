
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { QuizAttempt } from '../types';
import { apiService } from '../services/apiService'; // Use real API service
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import Button from '../components/Button';
import { TableCellsIcon, AcademicCapIcon, ArrowUturnLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const StudentReportsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      if (user && isAuthenticated) {
        setIsLoading(true); 
        setError(null);
        try {
          // FIX: Property 'getQuizAttemptsForUser' now exists on apiService
          const attempts = await apiService.getQuizAttemptsForUser(); // Fetches for current authenticated user
          setQuizAttempts(attempts);
        } catch (e) {
          console.error("Failed to fetch quiz attempts:", e);
          setError(e instanceof Error ? e.message : "Could not load your quiz reports. Please try again later.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false); 
      }
    };
    fetchAttempts();
  }, [user, isAuthenticated]);

  if (isLoading) {
    return ( <div className="text-center py-10"><LoadingSpinner /> <p className="mt-3 text-gray-600">Loading your quiz reports...</p></div> );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-xl transition-colors duration-300 ease-in-out">
        <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h2 className="mt-2 text-xl font-medium text-gray-900">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500">Please log in to view your quiz reports.</p>
        <div className="mt-6"> <Link to={ROUTES.LOGIN}><Button variant="primary">Login</Button></Link> </div>
      </div> );
  }
  
  if (error) {
    return (
      <div className="text-center py-10 bg-white p-8 rounded-lg shadow-xl">
        <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-400 mb-4" />
        <h2 className="mt-2 text-xl font-medium text-red-700">Error Loading Reports</h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-gray-200">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">My Quiz Reports</h1>
        <Link to={ROUTES.STUDENT_DASHBOARD}>
          <Button variant="secondary" className="mt-4 sm:mt-0 flex items-center">
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Dashboard
          </Button>
        </Link>
      </div>

      {quizAttempts.length > 0 ? (
        <div className="bg-white shadow-xl rounded-lg overflow-hidden transition-colors duration-300 ease-in-out">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quizAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{attempt.courseTitle}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">{attempt.quizTitle}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700"> {attempt.score} / {attempt.totalQuestions} </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        attempt.percentage >= 70 ? 'bg-green-100 text-green-800' : 
                        attempt.percentage >= 40 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800' }`}>
                        {attempt.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500"> {new Date(attempt.takenAt).toLocaleDateString()} </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {attempt.isQuizWith ? 
                            <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">QuizWith</span> :
                            <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Course Quiz</span>
                        }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-xl p-6 transition-colors duration-300 ease-in-out">
          <TableCellsIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">No Quiz Attempts Yet</h2>
          <p className="mt-2 text-md text-gray-600">You haven't taken any quizzes. Explore your courses and test your knowledge!</p>
          <div className="mt-8"> <Link to={ROUTES.STUDENT_DASHBOARD}> <Button variant="primary" size="lg">Go to My Courses</Button> </Link> </div>
        </div>
      )}
    </div>
  );
};

export default StudentReportsPage;