
export enum UserRole {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
}

export interface User {
  id: number; // Changed from string
  username: string;
  email: string;
  role: UserRole;
  enrolledCourseIds?: number[]; // Changed from string[]
  createdCourseIds?: number[]; // Changed from string[]
}

export interface Lesson {
  id: number; // Changed from string
  title: string;
  type: 'video' | 'document' | 'presentation';
  content: string; // For video, this could be a URL. For documents, markdown content or URL.
  orderIndex?: number; // Added from DB schema
  createdAt?: string; // Added from DB schema
  updatedAt?: string; // Added from DB schema
}

export interface QuizQuestionOption {
  id: number; // Changed from string
  text: string;
  isCorrect: boolean;
  createdAt?: string; // Added from DB schema
  updatedAt?: string; // Added from DB schema
}

export interface QuizQuestion {
  id: number; // Changed from string
  text: string;
  options: QuizQuestionOption[];
  type: 'mcq'; // Multiple Choice Question
  orderIndex?: number; // Added from DB schema
  createdAt?: string; // Added from DB schema
  updatedAt?: string; // Added from DB schema
}

export interface Quiz {
  id: number; // Changed from string
  title: string;
  courseId: number; // Changed from string
  questions: QuizQuestion[];
  createdAt?: string; // Added from DB schema
  updatedAt?: string; // Added from DB schema
}

export interface Course {
  id: number; // Changed from string
  title: string;
  description: string;
  instructorId: number; // Changed from string
  instructorName: string;
  imageUrl: string;
  lessons: Lesson[];
  quizIds: number[]; // Changed from string[]
  category: string;
  rating: number;
  enrollmentCount: number;
  createdAt?: string; // Added from DB schema
  updatedAt?: string; // Added from DB schema
}

export interface GeneratedQuizQuestion {
  text: string;
  options: string[]; // Text of options
  correctAnswerIndex: number; // Index of the correct option
}

// Types for QuizWith session simulation
export interface ActiveQuizWithSession {
  pin: string;
  sessionId: number; // Changed from string, assuming it's the DB ID
  quizId: number; // Changed from string
  courseId: number; // Changed from string
  hostUserId: number; // Changed from string
  status: 'waiting' | 'active' | 'finished'; // Status of the session
  quizTitle: string;
  createdAt?: string; // Added from DB schema
  updatedAt?: string; // Added from DB schema
}

export interface QuizWithPlayerInfo {
  nickname: string;
  joinedPin: string; // PIN is string
}

export interface QuizAttempt {
  id: number; // Changed from string // Unique ID for the attempt
  userId?: number; // Changed from string // If a logged-in user took it
  playerNickname?: string; // If taken via QuizWith by a guest
  quizId: number; // Changed from string
  quizTitle: string;
  courseId: number; // Changed from string
  courseTitle?: string; // Optional: denormalized for easier display
  score: number;
  totalQuestions: number;
  percentage: number;
  takenAt: string; // ISO date string
  isQuizWith: boolean; // To distinguish between regular quiz and QuizWith
}