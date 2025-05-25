
import { User, UserRole, Course, Lesson, Quiz, QuizQuestion, QuizQuestionOption, QuizAttempt, ActiveQuizWithSession } from '../types';

// --- Mock Database ---
let users: User[] = [
  { id: 1, username: 'Alice Wonderland', email: 'alice@example.com', role: UserRole.STUDENT, enrolledCourseIds: [101], createdCourseIds: [] },
  { id: 2, username: 'Bob The Builder', email: 'bob@example.com', role: UserRole.INSTRUCTOR, enrolledCourseIds: [], createdCourseIds: [101, 102] },
  { id: 3, username: 'Charlie Brown', email: 'charlie@example.com', role: UserRole.STUDENT, enrolledCourseIds: [], createdCourseIds: [] },
];

let courses: Course[] = [
  {
    id: 101,
    title: 'Introduction to Web Development',
    description: 'Learn the fundamentals of HTML, CSS, and JavaScript to build modern websites.',
    instructorId: 2,
    instructorName: 'Bob The Builder',
    imageUrl: 'https://picsum.photos/seed/webdevintro/600/400',
    lessons: [
      { id: 1001, title: 'HTML Basics', type: 'video', content: 'https://www.youtube.com/watch?v=somevideo1', orderIndex: 0 },
      { id: 1002, title: 'CSS Fundamentals', type: 'document', content: '# CSS Basics\n\nCSS stands for Cascading Style Sheets...', orderIndex: 1 },
    ],
    quizIds: [201],
    category: 'Development',
    rating: 4.5,
    enrollmentCount: 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 102,
    title: 'Advanced JavaScript Techniques',
    description: 'Dive deep into JavaScript concepts like closures, promises, and async/await.',
    instructorId: 2,
    instructorName: 'Bob The Builder',
    imageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=600&q=40',
    lessons: [
      { id: 1003, title: 'Understanding Closures', type: 'video', content: 'https://www.youtube.com/watch?v=somevideo2', orderIndex: 0 },
    ],
    quizIds: [202],
    category: 'Development',
    rating: 4.8,
    enrollmentCount: 75,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 103,
    title: 'Graphic Design Principles',
    description: 'Master the core principles of graphic design including color theory, typography, and layout.',
    instructorId: 4, // Placeholder for another instructor (Diana Designer)
    instructorName: 'Diana Designer',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=600&q=40',
    lessons: [],
    quizIds: [],
    category: 'Design',
    rating: 4.2,
    enrollmentCount: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

let quizzes: Quiz[] = [
  {
    id: 201,
    courseId: 101,
    title: 'HTML & CSS Basics Quiz',
    questions: [
      { id: 301, text: 'What does HTML stand for?', type: 'mcq', options: [
        { id: 401, text: 'HyperText Markup Language', isCorrect: true },
        { id: 402, text: 'HighText Machine Language', isCorrect: false },
        { id: 403, text: 'HyperText and links Markup Language', isCorrect: false },
        { id: 404, text: 'None of the above', isCorrect: false },
      ], orderIndex: 0},
      { id: 302, text: 'Which CSS property controls the text size?', type: 'mcq', options: [
        { id: 405, text: 'font-style', isCorrect: false },
        { id: 406, text: 'text-size', isCorrect: false },
        { id: 407, text: 'font-size', isCorrect: true },
        { id: 408, text: 'text-style', isCorrect: false },
      ], orderIndex: 1},
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 202,
    courseId: 102,
    title: 'JavaScript Advanced Quiz',
    questions: [
      { id: 303, text: 'What is a closure in JavaScript?', type: 'mcq', options: [
        { id: 409, text: 'A function having access to the parent scope, even after the parent function has closed.', isCorrect: true },
        { id: 410, text: 'A way to close the browser window.', isCorrect: false },
        { id: 411, text: 'A built-in JavaScript method.', isCorrect: false },
        { id: 412, text: 'A type of loop.', isCorrect: false },
      ], orderIndex: 0},
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

let quizAttempts: QuizAttempt[] = [];
let activeQuizWithSessions: ActiveQuizWithSession[] = [];

// --- Helper Functions ---
const generateNumericId = (): number => Math.floor(Date.now() * Math.random()); // Simplified numeric ID

const MOCK_AUTH_TOKEN = 'mockAuthToken123';
let currentMockUser: User | null = null;

// --- Mock API Functions ---

const login = async (email: string, _password_unused: string): Promise<{ token: string; user: User }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const user = users.find(u => u.email === email);
  if (user) {
    currentMockUser = user;
    localStorage.setItem('authToken', MOCK_AUTH_TOKEN);
    localStorage.setItem('mockUserId', user.id.toString()); // Store as string
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
    id: generateNumericId(),
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
  const userIdStr = localStorage.getItem('mockUserId');
  if (token === MOCK_AUTH_TOKEN && userIdStr) {
    const userId = parseInt(userIdStr, 10);
    currentMockUser = users.find(u => u.id === userId) || null;
    // Populate enrolled/created course IDs for the mock user if not already there
    if (currentMockUser) {
        currentMockUser.enrolledCourseIds = currentMockUser.enrolledCourseIds || [];
        currentMockUser.createdCourseIds = currentMockUser.createdCourseIds || [];
    }
    return currentMockUser;
  }
  currentMockUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('mockUserId');
  return null;
};

const getCourses = async (): Promise<Course[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return courses.map(c => ({...c, lessons: c.lessons || [], quizIds: c.quizIds || [] }));
};

const getCourseById = async (courseId: number): Promise<Course | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const course = courses.find(c => c.id === courseId);
  if (!course) return null;
  // Simulate fetching full details for the course
  const detailedCourse = {
    ...course,
    lessons: course.lessons || [],
    quizIds: quizzes.filter(q => q.courseId === courseId).map(q => q.id),
  };
  return detailedCourse;
};

const createCourse = async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>): Promise<Course> => {
  await new Promise(resolve => setTimeout(resolve, 700));
  if (!currentMockUser || currentMockUser.role !== UserRole.INSTRUCTOR) throw new Error('User not authorized to create courses');
  
  const newCourse: Course = {
    ...courseData,
    id: generateNumericId(),
    instructorName: currentMockUser.username,
    rating: 0,
    enrollmentCount: 0,
    lessons: courseData.lessons?.map(l => ({...l, id: generateNumericId(), orderIndex: l.orderIndex || 0 })) || [],
    quizIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  courses.push(newCourse);
  currentMockUser.createdCourseIds = [...(currentMockUser.createdCourseIds || []), newCourse.id];
  return { ...newCourse };
};

const updateCourse = async (courseId: number, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount' | 'quizIds' | 'createdAt' | 'updatedAt'>>): Promise<Course | null> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  const courseIndex = courses.findIndex(c => c.id === courseId);
  if (courseIndex === -1) throw new Error('Course not found.');
  if (!currentMockUser || courses[courseIndex].instructorId !== currentMockUser.id) throw new Error('User not authorized to update this course.');

  const updatedLessons = courseData.lessons?.map((l, idx) => ({
    id: l.id > 0 ? l.id : generateNumericId(), // Keep existing ID or generate new for temp ones
    ...l,
    orderIndex: l.orderIndex || idx,
  })) || courses[courseIndex].lessons;

  courses[courseIndex] = { ...courses[courseIndex], ...courseData, lessons: updatedLessons, updatedAt: new Date().toISOString() };
  return { ...courses[courseIndex] };
};

const addLessonToCourse = async (courseId: number, lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson | null> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  const course = courses.find(c => c.id === courseId);
  if (!course) throw new Error('Course not found.');
  if (!currentMockUser || course.instructorId !== currentMockUser.id) throw new Error('User not authorized to add lessons to this course.');

  const newLesson: Lesson = { ...lessonData, id: generateNumericId(), orderIndex: lessonData.orderIndex || (course.lessons?.length || 0), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  course.lessons = course.lessons ? [...course.lessons, newLesson] : [newLesson];
  return { ...newLesson };
};

const getQuizById = async (quizId: number): Promise<Quiz | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const quiz = quizzes.find(q => q.id === quizId);
  if (!quiz) return null;
  // Ensure questions and options have IDs
  const detailedQuiz = {
    ...quiz,
    questions: quiz.questions.map(q => ({
      ...q,
      id: q.id || generateNumericId(),
      options: q.options.map(o => ({...o, id: o.id || generateNumericId()}))
    }))
  };
  return detailedQuiz;
};

const createQuiz = async (quizData: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quiz> => {
  await new Promise(resolve => setTimeout(resolve, 700));
  const course = courses.find(c => c.id === quizData.courseId);
  if (!course) throw new Error('Course not found for this quiz.');
  if (!currentMockUser || course.instructorId !== currentMockUser.id) throw new Error('User not authorized to create quizzes for this course.');
  
  const newQuiz: Quiz = {
    ...quizData,
    id: generateNumericId(),
    questions: quizData.questions.map((q, qIndex) => ({
      ...q,
      id: generateNumericId(),
      orderIndex: q.orderIndex || qIndex,
      options: q.options.map(o => ({ ...o, id: generateNumericId() }))
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  quizzes.push(newQuiz);
  course.quizIds = [...(course.quizIds || []), newQuiz.id];
  return { ...newQuiz };
};

const getQuizzesForCourse = async (courseId: number): Promise<Quiz[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return quizzes.filter(q => q.courseId === courseId).map(q => ({
      ...q,
      questions: q.questions.map(ques => ({
          ...ques,
          options: ques.options.map(opt => ({...opt}))
      }))
  }));
};

const enrollInCourse = async (courseId: number): Promise<{ success: boolean; message?: string }> => {
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

const submitQuizScore = async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle' | 'quizTitle'>): Promise<QuizAttempt> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  const course = courses.find(c => c.id === attemptData.courseId);
  const quiz = quizzes.find(q => q.id === attemptData.quizId);
  const newAttempt: QuizAttempt = {
    ...attemptData,
    id: generateNumericId(),
    takenAt: new Date().toISOString(),
    percentage: attemptData.totalQuestions > 0 ? (attemptData.score / attemptData.totalQuestions) * 100 : 0,
    courseTitle: course?.title || 'Unknown Course',
    quizTitle: quiz?.title || 'Unknown Quiz',
    userId: currentMockUser && !attemptData.isQuizWith ? currentMockUser.id : attemptData.userId,
  };
  quizAttempts.push(newAttempt);
  return { ...newAttempt };
};

const getQuizAttemptsForUser = async (): Promise<QuizAttempt[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  if (!currentMockUser) return [];
  // Filter out QuizWith attempts if not explicitly requested by a different function
  return quizAttempts.filter(qa => qa.userId === currentMockUser!.id && !qa.isQuizWith).map(qa => ({...qa}));
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

const hostQuizWithSession = async (quizId: number): Promise<{ pin: string; sessionId: number }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (!currentMockUser || currentMockUser.role !== UserRole.INSTRUCTOR) throw new Error('Only instructors can host.');
  const quiz = quizzes.find(q => q.id === quizId);
  if (!quiz) throw new Error('Quiz not found.');
  if (!quiz.questions || quiz.questions.length === 0) throw new Error('Quiz has no questions.');

  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const sessionId = generateNumericId();
  const newSession: ActiveQuizWithSession = {
    pin,
    sessionId,
    quizId,
    courseId: quiz.courseId,
    hostUserId: currentMockUser.id,
    status: 'waiting',
    quizTitle: quiz.title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  activeQuizWithSessions.push(newSession);
  return { pin, sessionId };
};

const joinQuizWithSession = async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: number; courseId?: number; sessionId?: number }> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const session = activeQuizWithSessions.find(s => s.pin === pin && s.status === 'waiting');
  if (!session) return { success: false, message: 'Invalid or inactive PIN.' };
  return { success: true, message: 'Joined successfully!', quizId: session.quizId, courseId: session.courseId, sessionId: session.sessionId };
};

const getQuizWithSessionByPin = async (pin: string): Promise<ActiveQuizWithSession | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const session = activeQuizWithSessions.find(s => s.pin === pin);
  return session ? { ...session } : null;
};

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
