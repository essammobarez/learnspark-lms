import { User, Course, Quiz, Lesson, QuizAttempt, UserRole, ActiveQuizWithSession } from '../types';

// Base URL for your backend API
const API_BASE_URL = 'http://localhost:3001/api'; // Adjust if your backend runs elsewhere

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      // Try to parse error response as JSON, which might contain a 'message' field
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // If response is not JSON or error occurs during parsing, use the original status text.
      // console.warn("Could not parse error response as JSON:", e); 
    }
    throw new Error(errorMessage);
  }
  if (response.status === 204) { // No Content
    return undefined as T; 
  }
  // Assuming successful responses are JSON. If not, this could also throw.
  return response.json() as Promise<T>;
}

// Helper function to make requests
async function makeRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: any,
  isProtected: boolean = true // Most routes are protected
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (isProtected) {
    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn(`No auth token found for protected route: ${url}`);
    }
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    return handleResponse<T>(response);
  } catch (networkError) {
    // This catch block handles errors from the fetch() call itself (e.g., server not reachable)
    console.error(`Network error during fetch to ${url}:`, networkError);
    const specificMessage = `Failed to connect to the server at ${url}. Please ensure the backend is running and accessible. Original error: ${(networkError as Error).message}`;
    throw new Error(specificMessage);
  }
}

export const apiService = {
  // --- Auth ---
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    return makeRequest<{ token: string; user: User }>('/auth/login', 'POST', { email, password }, false);
  },

  signup: async (username: string, email: string, password: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    return makeRequest<{ success: boolean; message: string; user?: User }>('/auth/signup', 'POST', { username, email, password, role }, false);
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      return await makeRequest<User>('/auth/me', 'GET');
    } catch (error) {
      console.error("Error fetching current user:", error);
      return null;
    }
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    return makeRequest<Course[]>('/courses', 'GET', undefined, false);
  },

  getCourseById: async (courseId: string): Promise<Course | null> => {
    return makeRequest<Course | null>(`/courses/${courseId}`, 'GET', undefined, false); 
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'>): Promise<Course> => {
    return makeRequest<Course>('/courses', 'POST', courseData);
  },

  updateCourse: async (courseId: string, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>>): Promise<Course | null> => {
    return makeRequest<Course | null>(`/courses/${courseId}`, 'PUT', courseData);
  },
  
  addLessonToCourse: async (courseId: string, lessonData: Omit<Lesson, 'id'>): Promise<Lesson | null> => {
    return makeRequest<Lesson | null>(`/courses/${courseId}/lessons`, 'POST', lessonData);
  },

  // --- Quizzes ---
  getQuizById: async (quizId: string): Promise<Quiz | null> => {
    return makeRequest<Quiz | null>(`/quizzes/${quizId}`, 'GET', undefined, false); 
  },

  createQuiz: async (quizData: Omit<Quiz, 'id'>): Promise<Quiz> => {
    return makeRequest<Quiz>('/quizzes', 'POST', quizData);
  },
  
  getQuizzesForCourse: async (courseId: string): Promise<Quiz[]> => {
    return makeRequest<Quiz[]>(`/courses/${courseId}/quizzes`, 'GET', undefined, false);
  },

  // --- Enrollments ---
  enrollInCourse: async (courseId: string): Promise<{ success: boolean; message?: string }> => {
    return makeRequest<{ success: boolean; message?: string }>(`/courses/${courseId}/enroll`, 'POST');
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    return makeRequest<Course[]>('/users/me/enrolled-courses', 'GET');
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    return makeRequest<Course[]>('/users/me/created-courses', 'GET');
  },

  // --- Quiz Attempts & Reports ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle'>): Promise<QuizAttempt> => {
    return makeRequest<QuizAttempt>('/quiz-attempts', 'POST', attemptData);
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    return makeRequest<QuizAttempt[]>('/users/me/quiz-attempts', 'GET');
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    return makeRequest<Quiz[]>('/instructors/me/quizzes', 'GET');
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    return makeRequest<QuizAttempt[]>('/instructors/me/quiz-attempts', 'GET');
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
    return makeRequest<{ pin: string; sessionId: string }>('/quizwith/host', 'POST', { quizId });
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
    return makeRequest<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }>(
      '/quizwith/join', 
      'POST', 
      { pin, nickname },
      false 
    );
  },
  
  getQuizWithSessionByPin: async (pin: string): Promise<ActiveQuizWithSession | null> => { 
    return makeRequest<ActiveQuizWithSession | null>(`/quizwith/sessions/${pin}`, 'GET', undefined, false);
  },
};
