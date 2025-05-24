
export enum UserRole {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  enrolledCourseIds?: string[];
  createdCourseIds?: string[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'document' | 'presentation';
  content: string; // For video, this could be a URL. For documents, markdown content or URL.
}

export interface QuizQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizQuestionOption[];
  type: 'mcq'; // Multiple Choice Question
}

export interface Quiz {
  id: string;
  title: string;
  courseId: string;
  questions: QuizQuestion[];
}

export interface Course {
  id:string;
  title: string;
  description: string;
  instructorId: string;
  instructorName: string;
  imageUrl: string;
  lessons: Lesson[];
  quizIds: string[];
  category: string;
  rating: number;
  enrollmentCount: number;
}

export interface GeneratedQuizQuestion {
  text: string;
  options: string[]; // Text of options
  correctAnswerIndex: number; // Index of the correct option
}

// Types for QuizWith session simulation
export interface ActiveQuizWithSession {
  pin: string;
  quizId: string;
  courseId: string;
  hostUserId: string;
  status: 'waiting' | 'active' | 'finished'; // Status of the session
  quizTitle: string;
}

export interface QuizWithPlayerInfo {
  nickname: string;
  joinedPin: string;
}

export interface QuizAttempt {
  id: string; // Unique ID for the attempt
  userId?: string; // If a logged-in user took it
  playerNickname?: string; // If taken via QuizWith by a guest
  quizId: string;
  quizTitle: string;
  courseId: string;
  courseTitle?: string; // Optional: denormalized for easier display
  score: number;
  totalQuestions: number;
  percentage: number;
  takenAt: string; // ISO date string
  isQuizWith: boolean; // To distinguish between regular quiz and QuizWith
}