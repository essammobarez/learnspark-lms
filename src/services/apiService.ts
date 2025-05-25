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


export const apiService = {
  // --- Auth ---
  login: async (email: string, password_unused: string): Promise<{ token: string; user: User }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password: password_unused }), // Backend expects password
    });
    return handleResponse(response);
  },

  signup: async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, email, password: password_unused, role }), // Backend expects password
    });
    return handleResponse(response);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    const response = await fetch(`${API_BASE_URL}/courses`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  getCourseById: async (courseId: number): Promise<Course | null> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>): Promise<Course> => {
    const response = await fetch(`${API_BASE_URL}/courses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(courseData),
    });
    return handleResponse(response);
  },

  updateCourse: async (courseId: number, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>>): Promise<Course | null> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(courseData),
    });
    return handleResponse(response);
  },
  
  addLessonToCourse: async (courseId: number, lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson | null> => {
     const response = await fetch(`${API_BASE_URL}/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(lessonData),
    });
    return handleResponse(response);
  },

  // --- Quizzes ---
  getQuizById: async (quizId: number): Promise<Quiz | null> => {
    const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  createQuiz: async (quizData: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quiz> => {
    const response = await fetch(`${API_BASE_URL}/quizzes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(quizData),
    });
    return handleResponse(response);
  },
  
  getQuizzesForCourse: async (courseId: number): Promise<Quiz[]> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}/quizzes`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  // --- Enrollments ---
  enrollInCourse: async (courseId: number): Promise<{ success: boolean; message?: string }> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}/enroll`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    const response = await fetch(`${API_BASE_URL}/users/me/enrolled-courses`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    const response = await fetch(`${API_BASE_URL}/users/me/created-courses`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  // --- Quiz Attempts & Reports ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle' | 'quizTitle'>): Promise<QuizAttempt> => {
    const response = await fetch(`${API_BASE_URL}/quiz-attempts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(attemptData),
    });
    return handleResponse(response);
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    const response = await fetch(`${API_BASE_URL}/users/me/quiz-attempts`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
     const response = await fetch(`${API_BASE_URL}/instructors/me/quizzes`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    const response = await fetch(`${API_BASE_URL}/instructors/me/quiz-attempts`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: number): Promise<{ pin: string; sessionId: number }> => {
    const response = await fetch(`${API_BASE_URL}/quizwith/host`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ quizId }),
    });
    return handleResponse(response);
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: number; courseId?: number; sessionId?: number }> => {
    const response = await fetch(`${API_BASE_URL}/quizwith/join`, {
      method: 'POST',
      headers: getAuthHeaders(), // No auth typically needed for guests to join with PIN
      body: JSON.stringify({ pin, nickname }),
    });
    return handleResponse(response);
  },
  
  getQuizWithSessionByPin: async (pin: string): Promise<ActiveQuizWithSession | null> => {
    const response = await fetch(`${API_BASE_URL}/quizwith/sessions/${pin}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
};