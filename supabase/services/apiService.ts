
import { User, Course, Quiz, Lesson, QuizAttempt, UserRole } from '../types';

const API_BASE_URL = '/api'; // Replace with your actual backend API base URL

interface ApiErrorData {
  message?: string;
  error?: string;
  errors?: Array<{param?: string, msg: string}>; // For validation errors
}

const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorData: ApiErrorData = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // Ignore if response is not JSON
    }
    const message = errorData.message || errorData.error || `HTTP error ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const getHeaders = (includeAuth = true): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
};

export const apiService = {
  // --- Auth ---
  login: async (email: string, password_unused: string): Promise<{ token: string; user: User }> => {
    // In a real app, 'password_unused' would be 'password'
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ email, password: password_unused }),
    });
    return handleResponse<{ token: string; user: User }>(response);
  },

  signup: async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ username, email, password: password_unused, role }),
    });
    return handleResponse<{ success: boolean; message: string; user?: User }>(response);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
      return await handleResponse<User>(response);
    } catch (error) {
      console.warn("Failed to fetch current user, token might be invalid:", error);
      localStorage.removeItem('authToken'); // Clear invalid token
      return null;
    }
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    const response = await fetch(`${API_BASE_URL}/courses`, { headers: getHeaders() });
    return handleResponse<Course[]>(response);
  },

  getCourseById: async (courseId: string): Promise<Course | null> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, { headers: getHeaders() });
    return handleResponse<Course>(response);
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'>): Promise<Course> => {
    const response = await fetch(`${API_BASE_URL}/courses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(courseData),
    });
    return handleResponse<Course>(response);
  },

  updateCourse: async (courseId: string, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>>): Promise<Course | null> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(courseData),
    });
    return handleResponse<Course>(response);
  },
  
  addLessonToCourse: async (courseId: string, lessonData: Omit<Lesson, 'id'>): Promise<Lesson | null> => {
    // Assuming endpoint structure: POST /api/courses/:courseId/lessons
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(lessonData),
    });
    return handleResponse<Lesson>(response);
  },

  // --- Quizzes ---
  getQuizById: async (quizId: string): Promise<Quiz | null> => {
    const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, { headers: getHeaders() });
    return handleResponse<Quiz>(response);
  },

  createQuiz: async (quizData: Omit<Quiz, 'id'>): Promise<Quiz> => {
    // Assuming endpoint: POST /api/courses/:courseId/quizzes or just /api/quizzes if courseId is in quizData
    const response = await fetch(`${API_BASE_URL}/quizzes`, { // Adjust endpoint if needed
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(quizData),
    });
    return handleResponse<Quiz>(response);
  },
  
  getQuizzesForCourse: async (courseId: string): Promise<Quiz[]> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}/quizzes`, { headers: getHeaders() });
    return handleResponse<Quiz[]>(response);
  },

  // --- Enrollments ---
  enrollInCourse: async (courseId: string): Promise<{ success: boolean; message?: string }> => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}/enroll`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<{ success: boolean; message?: string }>(response);
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    // Assuming endpoint for current user's enrolled courses
    const response = await fetch(`${API_BASE_URL}/users/me/enrolled-courses`, { headers: getHeaders() });
    return handleResponse<Course[]>(response);
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    // Assuming endpoint for current user's (instructor) created courses
    const response = await fetch(`${API_BASE_URL}/users/me/created-courses`, { headers: getHeaders() });
    return handleResponse<Course[]>(response);
  },

  // --- Quiz Attempts & Reports ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle'>): Promise<QuizAttempt> => {
    const response = await fetch(`${API_BASE_URL}/quiz-attempts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(attemptData),
    });
    return handleResponse<QuizAttempt>(response);
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    // Assuming endpoint for current user's quiz attempts
    const response = await fetch(`${API_BASE_URL}/users/me/quiz-attempts`, { headers: getHeaders() });
    return handleResponse<QuizAttempt[]>(response);
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    // Assuming endpoint for current instructor's quizzes
    const response = await fetch(`${API_BASE_URL}/instructors/me/quizzes`, { headers: getHeaders() });
    return handleResponse<Quiz[]>(response);
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    // Assuming endpoint for current instructor to get all attempts for their quizzes
    const response = await fetch(`${API_BASE_URL}/instructors/me/quiz-attempts`, { headers: getHeaders() });
    return handleResponse<QuizAttempt[]>(response);
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
    const response = await fetch(`${API_BASE_URL}/quizwith/host`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ quizId }),
    });
    return handleResponse<{ pin: string; sessionId: string }>(response);
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
    const response = await fetch(`${API_BASE_URL}/quizwith/join`, {
      method: 'POST',
      headers: getHeaders(false), // Joining might not require auth token initially
      body: JSON.stringify({ pin, nickname }),
    });
    return handleResponse<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }>(response);
  },
  
  // Example: Get active QuizWith session details by PIN (for host or players)
  getQuizWithSessionByPin: async (pin: string): Promise<any> => { // Replace 'any' with actual session type
    const response = await fetch(`${API_BASE_URL}/quizwith/sessions/${pin}`, { headers: getHeaders() });
    return handleResponse<any>(response);
  },
};