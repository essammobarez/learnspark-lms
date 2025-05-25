import { User, Course, Quiz, Lesson, QuizAttempt, UserRole, ActiveQuizWithSession } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  if (response.status === 204) { // No Content
    return null;
  }
  return response.json();
};

const handleNetworkError = (error: unknown, endpoint: string) => {
  console.error(`API Error (${endpoint}):`, error);
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    throw new Error(`Unable to connect to the API server at ${API_BASE_URL}. Please check if the server is running and accessible.`);
  }
  throw error;
};

export const apiService = {
  // --- Auth ---
  login: async (email: string, password_unused: string): Promise<{ token: string; user: User }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password: password_unused }), // Backend expects password
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/auth/login');
    }
  },

  signup: async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ username, email, password: password_unused, role }), // Backend expects password
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/auth/signup');
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/auth/me');
    }
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    try {
      console.log('Fetching courses from:', `${API_BASE_URL}/courses`);
      const response = await fetch(`${API_BASE_URL}/courses`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/courses');
    }
  },

  getCourseById: async (courseId: number): Promise<Course | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/courses/${courseId}`);
    }
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>): Promise<Course> => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(courseData),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/courses');
    }
  },

  updateCourse: async (courseId: number, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>>): Promise<Course | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(courseData),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/courses/${courseId}`);
    }
  },
  
  addLessonToCourse: async (courseId: number, lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(lessonData),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/courses/${courseId}/lessons`);
    }
  },

  // --- Quizzes ---
  getQuizById: async (quizId: number): Promise<Quiz | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/quizzes/${quizId}`);
    }
  },

  createQuiz: async (quizData: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quiz> => {
    try {
      const response = await fetch(`${API_BASE_URL}/quizzes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(quizData),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/quizzes');
    }
  },
  
  getQuizzesForCourse: async (courseId: number): Promise<Quiz[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}/quizzes`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/courses/${courseId}/quizzes`);
    }
  },

  // --- Enrollments ---
  enrollInCourse: async (courseId: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/courses/${courseId}/enroll`);
    }
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/enrolled-courses`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/users/me/enrolled-courses');
    }
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/created-courses`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/users/me/created-courses');
    }
  },

  // --- Quiz Attempts & Reports ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle' | 'quizTitle'>): Promise<QuizAttempt> => {
    try {
      const response = await fetch(`${API_BASE_URL}/quiz-attempts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(attemptData),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/quiz-attempts');
    }
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/quiz-attempts`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/users/me/quiz-attempts');
    }
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/instructors/me/quizzes`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/instructors/me/quizzes');
    }
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/instructors/me/quiz-attempts`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/instructors/me/quiz-attempts');
    }
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: number): Promise<{ pin: string; sessionId: number }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/quizwith/host`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ quizId }),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/quizwith/host');
    }
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: number; courseId?: number; sessionId?: number }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/quizwith/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin, nickname }),
      });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, '/quizwith/join');
    }
  },
  
  getQuizWithSessionByPin: async (pin: string): Promise<ActiveQuizWithSession | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/quizwith/sessions/${pin}`, { headers: getAuthHeaders() });
      return handleResponse(response);
    } catch (error) {
      return handleNetworkError(error, `/quizwith/sessions/${pin}`);
    }
  },
};