
import { User, UserRole, Course, Lesson, Quiz, QuizQuestion, QuizQuestionOption, QuizAttempt, ActiveQuizWithSession } from '../types';

// --- Mock Database ---
let users: User[] = [
  { id: 'user-student-1', username: 'Alice Wonderland', email: 'alice@example.com', role: UserRole.STUDENT, enrolledCourseIds: ['course-1'], createdCourseIds: [] },
  { id: 'user-instructor-1', username: 'Bob The Builder', email: 'bob@example.com', role: UserRole.INSTRUCTOR, enrolledCourseIds: [], createdCourseIds: ['course-1', 'course-2'] },
  { id: 'user-student-2', username: 'Charlie Brown', email: 'charlie@example.com', role: UserRole.STUDENT, enrolledCourseIds: [], createdCourseIds: [] },
];

let courses: Course[] = [
  {
    id: 'course-1',
    title: 'Introduction to Web Development',
    description: 'Learn the fundamentals of HTML, CSS, and JavaScript to build modern websites.',
    instructorId: 'user-instructor-1',
    instructorName: 'Bob The Builder',
    imageUrl: 'https://picsum.photos/seed/webdevintro/600/400', // Changed from Unsplash to Picsum
    lessons: [
      { id: 'lesson-1-1', title: 'HTML Basics', type: 'video', content: 'https://www.youtube.com/watch?v=somevideo1' },
      { id: 'lesson-1-2', title: 'CSS Fundamentals', type: 'document', content: '# CSS Basics\n\nCSS stands for Cascading Style Sheets...' },
    ],
    quizIds: ['quiz-1'],
    category: 'Development',
    rating: 4.5,
    enrollmentCount: 120,
  },
  {
    id: 'course-2',
    title: 'Advanced JavaScript Techniques',
    description: 'Dive deep into JavaScript concepts like closures, promises, and async/await.',
    instructorId: 'user-instructor-1',
    instructorName: 'Bob The Builder',
    imageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8amF2YXNjcmlwdHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=600&q=40',
    lessons: [
      { id: 'lesson-2-1', title: 'Understanding Closures', type: 'video', content: 'https://www.youtube.com/watch?v=somevideo2' },
    ],
    quizIds: ['quiz-2'],
    category: 'Development',
    rating: 4.8,
    enrollmentCount: 75,
  },
  {
    id: 'course-3',
    title: 'Graphic Design Principles',
    description: 'Master the core principles of graphic design including color theory, typography, and layout.',
    instructorId: 'user-instructor-2', // Placeholder for another instructor
    instructorName: 'Diana Designer',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Z3JhcGhpYyUyMGRlc2lnbnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=600&q=40',
    lessons: [],
    quizIds: [],
    category: 'Design',
    rating: 4.2,
    enrollmentCount: 90,
  }
];

let quizzes: Quiz[] = [
  {
    id: 'quiz-1',
    courseId: 'course-1',
    title: 'HTML & CSS Basics Quiz',
    questions: [
      { id: 'q-1-1', text: 'What does HTML stand for?', type: 'mcq', options: [
        { id: 'opt-1-1-1', text: 'HyperText Markup Language', isCorrect: true },
        { id: 'opt-1-1-2', text: 'HighText Machine Language', isCorrect: false },
        { id: 'opt-1-1-3', text: 'HyperText and links Markup Language', isCorrect: false },
        { id: 'opt-1-1-4', text: 'None of the above', isCorrect: false },
      ]},
      { id: 'q-1-2', text: 'Which CSS property controls the text size?', type: 'mcq', options: [
        { id: 'opt-1-2-1', text: 'font-style', isCorrect: false },
        { id: 'opt-1-2-2', text: 'text-size', isCorrect: false },
        { id: 'opt-1-2-3', text: 'font-size', isCorrect: true },
        { id: 'opt-1-2-4', text: 'text-style', isCorrect: false },
      ]},
    ],
  },
  {
    id: 'quiz-2',
    courseId: 'course-2',
    title: 'JavaScript Advanced Quiz',
    questions: [
      { id: 'q-2-1', text: 'What is a closure in JavaScript?', type: 'mcq', options: [
        { id: 'opt-2-1-1', text: 'A function having access to the parent scope, even after the parent function has closed.', isCorrect: true },
        { id: 'opt-2-1-2', text: 'A way to close the browser window.', isCorrect: false },
        { id: 'opt-2-1-3', text: 'A built-in JavaScript method.', isCorrect: false },
        { id: 'opt-2-1-4', text: 'A type of loop.', isCorrect: false },
      ]},
    ],
  }
];

let quizAttempts: QuizAttempt[] = [];
let activeQuizWithSessions: ActiveQuizWithSession[] = [];

// --- Helper Functions ---
const generateId = (prefix: string = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const MOCK_AUTH_TOKEN = 'mockAuthToken123';
let currentMockUser: User | null = null; // Simulate session

// --- Mock API Functions ---

// Auth
const login = async (email: string, _password_unused: string): Promise<{ token: string; user: User }> => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  const user = users.find(u => u.email === email);
  if (user) {
    currentMockUser = user; // Simulate setting current user session
    localStorage.setItem('authToken', MOCK_AUTH_TOKEN); // Store mock token
    localStorage.setItem('mockUserId', user.id); // Store mock user ID
    return { token: MOCK_AUTH_TOKEN, user };
  }
  throw new Error('Invalid email or password.');
};

const signup = async (username: string, email: string, _password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (users.some(u => u.email === email)) {
    return { success: false, message: 'Email already exists.' };
  }
  const newUser: User = {
    id: generateId('user'),
    username,
    email,
    role,
    enrolledCourseIds: [],
    createdCourseIds: [],
  };
  users.push(newUser);
  return { success: true, message: 'Signup successful!', user: newUser };
};

const getCurrentUser = async (): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('mockUserId');
  if (token === MOCK_AUTH_TOKEN && userId) {
    currentMockUser = users.find(u => u.id === userId) || null;
    return currentMockUser;
  }
  currentMockUser = null; // Clear if token/userId mismatch
  localStorage.removeItem('authToken');
  localStorage.removeItem('mockUserId');
  return null;
};

// Courses
const getCourses = async (): Promise<Course[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [...courses];
};

const getCourseById = async (courseId: string): Promise<Course | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const course = courses.find(c => c.id === courseId);
  return course ? { ...course } : null;
};

const createCourse = async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'>): Promise<Course> => {
  await new Promise(resolve => setTimeout(resolve, 700));
  if (!currentMockUser || currentMockUser.role !== UserRole.INSTRUCTOR) throw new Error('User not authorized to create courses');
  
  const newCourse: Course = {
    ...courseData,
    id: generateId('course'),
    instructorName: currentMockUser.username,
    rating: 0,
    enrollmentCount: 0,
    lessons: courseData.lessons?.map(l => ({...l, id: generateId('lesson')})) || [],
  };
  courses.push(newCourse);
  currentMockUser.createdCourseIds?.push(newCourse.id);
  return { ...newCourse };
};

const updateCourse = async (courseId: string, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>>): Promise<Course | null> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  const courseIndex = courses.findIndex(c => c.id === courseId);
  if (courseIndex === -1) throw new Error('Course not found.');
  if (!currentMockUser || courses[courseIndex].instructorId !== currentMockUser.id) throw new Error('User not authorized to update this course.');

  // Ensure lessons have IDs if they are new, or preserve existing ones
  const updatedLessons = courseData.lessons?.map(l => l.id.startsWith('new_lesson_') ? { ...l, id: generateId('lesson') } : l) || courses[courseIndex].lessons;

  courses[courseIndex] = { ...courses[courseIndex], ...courseData, lessons: updatedLessons };
  return { ...courses[courseIndex] };
};

const addLessonToCourse = async (courseId: string, lessonData: Omit<Lesson, 'id'>): Promise<Lesson | null> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  const course = courses.find(c => c.id === courseId);
  if (!course) throw new Error('Course not found.');
  if (!currentMockUser || course.instructorId !== currentMockUser.id) throw new Error('User not authorized to add lessons to this course.');

  const newLesson: Lesson = { ...lessonData, id: generateId('lesson') };
  course.lessons = course.lessons ? [...course.lessons, newLesson] : [newLesson];
  return { ...newLesson };
};

// Quizzes
const getQuizById = async (quizId: string): Promise<Quiz | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const quiz = quizzes.find(q => q.id === quizId);
  return quiz ? { ...quiz } : null;
};

const createQuiz = async (quizData: Omit<Quiz, 'id'>): Promise<Quiz> => {
  await new Promise(resolve => setTimeout(resolve, 700));
  const course = courses.find(c => c.id === quizData.courseId);
  if (!course) throw new Error('Course not found for this quiz.');
  if (!currentMockUser || course.instructorId !== currentMockUser.id) throw new Error('User not authorized to create quizzes for this course.');
  
  const newQuiz: Quiz = {
    ...quizData,
    id: generateId('quiz'),
    questions: quizData.questions.map(q => ({
      ...q,
      id: generateId('question'),
      options: q.options.map(o => ({ ...o, id: generateId('option') }))
    }))
  };
  quizzes.push(newQuiz);
  course.quizIds.push(newQuiz.id);
  return { ...newQuiz };
};

const getQuizzesForCourse = async (courseId: string): Promise<Quiz[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return quizzes.filter(q => q.courseId === courseId).map(q => ({...q}));
};

// Enrollments
const enrollInCourse = async (courseId: string): Promise<{ success: boolean; message?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (!currentMockUser) throw new Error('User not logged in.');
  const course = courses.find(c => c.id === courseId);
  if (!course) return { success: false, message: 'Course not found.' };
  if (currentMockUser.enrolledCourseIds?.includes(courseId)) return { success: false, message: 'Already enrolled.' };
  
  currentMockUser.enrolledCourseIds = [...(currentMockUser.enrolledCourseIds || []), courseId];
  course.enrollmentCount++;
  return { success: true, message: 'Successfully enrolled!' };
};

const getEnrolledCourses = async (): Promise<Course[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  if (!currentMockUser || !currentMockUser.enrolledCourseIds) return [];
  return courses.filter(c => currentMockUser.enrolledCourseIds?.includes(c.id)).map(c => ({...c}));
};

const getCreatedCourses = async (): Promise<Course[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  if (!currentMockUser || !currentMockUser.createdCourseIds) return [];
  return courses.filter(c => currentMockUser.createdCourseIds?.includes(c.id)).map(c => ({...c}));
};


// Quiz Attempts & Reports
const submitQuizScore = async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle'>): Promise<QuizAttempt> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  const course = courses.find(c => c.id === attemptData.courseId);
  const newAttempt: QuizAttempt = {
    ...attemptData,
    id: generateId('attempt'),
    takenAt: new Date().toISOString(),
    percentage: (attemptData.score / attemptData.totalQuestions) * 100,
    courseTitle: course?.title || 'Unknown Course',
    userId: currentMockUser && !attemptData.isQuizWith ? currentMockUser.id : attemptData.userId,
  };
  quizAttempts.push(newAttempt);
  return { ...newAttempt };
};

const getQuizAttemptsForUser = async (): Promise<QuizAttempt[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  if (!currentMockUser) return [];
  return quizAttempts.filter(qa => qa.userId === currentMockUser.id && !qa.isQuizWith).map(qa => ({...qa}));
};

const getQuizzesForInstructor = async (): Promise<Quiz[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!currentMockUser || currentMockUser.role !== UserRole.INSTRUCTOR || !currentMockUser.createdCourseIds) return [];
    const instructorCourseIds = currentMockUser.createdCourseIds;
    return quizzes.filter(q => instructorCourseIds.includes(q.courseId)).map(q => ({...q}));
};

const getQuizAttemptsForInstructorQuizzes = async (): Promise<QuizAttempt[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!currentMockUser || currentMockUser.role !== UserRole.INSTRUCTOR || !currentMockUser.createdCourseIds) return [];
    const instructorCourseIds = currentMockUser.createdCourseIds;
    return quizAttempts.filter(qa => instructorCourseIds.includes(qa.courseId)).map(qa => ({...qa}));
};


// QuizWith
const hostQuizWithSession = async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (!currentMockUser || currentMockUser.role !== UserRole.INSTRUCTOR) throw new Error('Only instructors can host.');
  const quiz = quizzes.find(q => q.id === quizId);
  if (!quiz) throw new Error('Quiz not found.');
  if (!quiz.questions || quiz.questions.length === 0) throw new Error('Quiz has no questions.');

  const pin = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit PIN
  const sessionId = generateId('session');
  const newSession: ActiveQuizWithSession = {
    pin,
    sessionId, // Added this line from description
    quizId,
    courseId: quiz.courseId,
    hostUserId: currentMockUser.id,
    status: 'waiting',
    quizTitle: quiz.title,
  };
  activeQuizWithSessions.push(newSession);
  return { pin, sessionId };
};

const joinQuizWithSession = async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const session = activeQuizWithSessions.find(s => s.pin === pin && s.status === 'waiting');
  if (!session) return { success: false, message: 'Invalid or inactive PIN.' };
  // In a real backend, you'd add the player to the session
  // For mock, we just acknowledge success
  return { success: true, message: 'Joined successfully!', quizId: session.quizId, courseId: session.courseId, sessionId: session.sessionId };
};

const getQuizWithSessionByPin = async (pin: string): Promise<ActiveQuizWithSession | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const session = activeQuizWithSessions.find(s => s.pin === pin);
  return session ? { ...session } : null;
};

// Export all mock functions
export const mockApiService = {
  login,
  signup,
  getCurrentUser,
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  addLessonToCourse,
  getQuizById,
  createQuiz,
  getQuizzesForCourse,
  enrollInCourse,
  getEnrolledCourses,
  getCreatedCourses,
  submitQuizScore,
  getQuizAttemptsForUser,
  getQuizzesForInstructor,
  getQuizAttemptsForInstructorQuizzes,
  hostQuizWithSession,
  joinQuizWithSession,
  getQuizWithSessionByPin,
};
