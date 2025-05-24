
import { MOCK_COURSES, MOCK_USERS, MOCK_QUIZZES, QUIZ_ATTEMPTS_LS_KEY, MOCK_QUIZ_ATTEMPTS } from '../constants';
import { Course, User, Quiz, QuizQuestion, Lesson, QuizAttempt, UserRole } from '../types';

const SIMULATED_DELAY = 500; // ms

let coursesStore: Course[] = [...MOCK_COURSES];
let quizzesStore: Quiz[] = [...MOCK_QUIZZES];
let usersStore: User[] = [...MOCK_USERS];

// Initialize quizAttemptsStore from localStorage or MOCK_QUIZ_ATTEMPTS
let quizAttemptsStore: QuizAttempt[];
const storedAttempts = localStorage.getItem(QUIZ_ATTEMPTS_LS_KEY);
if (storedAttempts) {
  quizAttemptsStore = JSON.parse(storedAttempts);
} else {
  quizAttemptsStore = [...MOCK_QUIZ_ATTEMPTS]; // Typically empty at start
}

const saveQuizAttemptsToLocalStorage = () => {
  localStorage.setItem(QUIZ_ATTEMPTS_LS_KEY, JSON.stringify(quizAttemptsStore));
};


export const mockApiService = {
  login: (email: string, password_unused: string): Promise<User | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = usersStore.find(u => u.email === email);
        resolve(user || null);
      }, SIMULATED_DELAY);
    });
  },

  signup: (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const existingUser = usersStore.find(u => u.email === email);
        if (existingUser) {
          resolve({ success: false, message: 'Email already exists.' });
          return;
        }
        const newUser: User = {
          id: `user${usersStore.length + 1}_${Date.now()}`,
          username,
          email,
          role,
          enrolledCourseIds: role === UserRole.STUDENT ? [] : undefined,
          createdCourseIds: role === UserRole.INSTRUCTOR ? [] : undefined,
        };
        usersStore.push(newUser);
        // Note: In a real app, password would be hashed and stored securely.
        // For dev purposes and role switching, we might need to update AuthContext's MOCK_USERS if we want persistence across refreshes without re-login
        // For now, this new user is only in the in-memory usersStore unless we also update MOCK_USERS and localStorage in AuthContext.
        // The current AuthContext loads from MOCK_USERS for dev switching, so this new user won't be available for dev switch.
        resolve({ success: true, message: 'Signup successful! Please log in.', user: newUser });
      }, SIMULATED_DELAY);
    });
  },

  getCourses: (): Promise<Course[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...coursesStore]);
      }, SIMULATED_DELAY);
    });
  },

  getCourseById: (courseId: string): Promise<Course | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const course = coursesStore.find(c => c.id === courseId);
        resolve(course || null);
      }, SIMULATED_DELAY);
    });
  },

  createCourse: (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'>, instructor: User): Promise<Course> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newCourse: Course = {
          ...courseData,
          id: `course${coursesStore.length + 1}${Date.now()}`, // Ensure unique ID
          instructorName: instructor.username,
          rating: 0,
          enrollmentCount: 0,
        };
        coursesStore.push(newCourse);
        // Update instructor's created courses
        const userIndex = usersStore.findIndex(u => u.id === instructor.id);
        if (userIndex > -1) {
          usersStore[userIndex].createdCourseIds = [...(usersStore[userIndex].createdCourseIds || []), newCourse.id];
        }
        resolve(newCourse);
      }, SIMULATED_DELAY);
    });
  },

  updateCourse: (courseId: string, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>>): Promise<Course | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const courseIndex = coursesStore.findIndex(c => c.id === courseId);
        if (courseIndex > -1) {
          // Ensure lessons have unique IDs if new ones are added or existing ones are modified without IDs
          const updatedLessons = courseData.lessons?.map((lesson, index) => ({
            ...lesson,
            id: lesson.id || `l${index+1}c${courseId.replace('course','')}_updated_${Date.now()}`
          })) || coursesStore[courseIndex].lessons;

          coursesStore[courseIndex] = {
            ...coursesStore[courseIndex],
            ...courseData,
            lessons: updatedLessons,
          };
          resolve(coursesStore[courseIndex]);
        } else {
          resolve(null);
        }
      }, SIMULATED_DELAY);
    });
  },
  
  addLessonToCourse: (courseId: string, lessonData: Omit<Lesson, 'id'>): Promise<Lesson | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const courseIndex = coursesStore.findIndex(c => c.id === courseId);
        if (courseIndex > -1) {
          const newLesson: Lesson = {
            ...lessonData,
            id: `l${coursesStore[courseIndex].lessons.length + 1}c${courseId.replace('course','')}_${Date.now()}`
          };
          coursesStore[courseIndex].lessons.push(newLesson);
          resolve(newLesson);
        } else {
          resolve(null);
        }
      }, SIMULATED_DELAY);
    });
  },

  getQuizById: (quizId: string): Promise<Quiz | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const quiz = quizzesStore.find(q => q.id === quizId);
        resolve(quiz || null);
      }, SIMULATED_DELAY);
    });
  },

  createQuiz: (quizData: Omit<Quiz, 'id'>, courseId: string): Promise<Quiz> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newQuiz: Quiz = {
          ...quizData,
          id: `quiz${quizzesStore.length + 1}_${Date.now()}`,
          courseId: courseId,
        };
        quizzesStore.push(newQuiz);
        // Add quizId to the course
        const courseIndex = coursesStore.findIndex(c => c.id === courseId);
        if (courseIndex > -1) {
            coursesStore[courseIndex].quizIds.push(newQuiz.id);
        }
        resolve(newQuiz);
      }, SIMULATED_DELAY);
    });
  },

  enrollInCourse: (userId: string, courseId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const userIndex = usersStore.findIndex(u => u.id === userId);
        const courseExists = coursesStore.some(c => c.id === courseId);
        if (userIndex > -1 && courseExists) {
          if (!usersStore[userIndex].enrolledCourseIds?.includes(courseId)) {
            usersStore[userIndex].enrolledCourseIds = [...(usersStore[userIndex].enrolledCourseIds || []), courseId];
          }
          // Increment enrollment count
          const courseIdx = coursesStore.findIndex(c => c.id === courseId);
          if(courseIdx > -1) {
            coursesStore[courseIdx].enrollmentCount = (coursesStore[courseIdx].enrollmentCount || 0) + 1;
          }
          resolve(true);
        } else {
          resolve(false);
        }
      }, SIMULATED_DELAY);
    });
  },

  getEnrolledCourses: (userId: string): Promise<Course[]> => {
     return new Promise((resolve) => {
      setTimeout(() => {
        const user = usersStore.find(u => u.id === userId);
        if (user && user.enrolledCourseIds) {
          const enrolled = coursesStore.filter(course => user.enrolledCourseIds!.includes(course.id));
          resolve(enrolled);
        } else {
          resolve([]);
        }
      }, SIMULATED_DELAY);
    });
  },

  getCreatedCourses: (userId: string): Promise<Course[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = usersStore.find(u => u.id === userId);
        if (user && user.createdCourseIds) {
          const created = coursesStore.filter(course => user.createdCourseIds!.includes(course.id));
          resolve(created);
        } else {
          resolve([]);
        }
      }, SIMULATED_DELAY);
    });
  },

  // --- Quiz Attempt Reporting ---
  submitQuizScore: (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage'>): Promise<QuizAttempt> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const course = coursesStore.find(c => c.id === attemptData.courseId);
        const newAttempt: QuizAttempt = {
          ...attemptData,
          id: `attempt_${Date.now()}`,
          takenAt: new Date().toISOString(),
          percentage: attemptData.totalQuestions > 0 ? (attemptData.score / attemptData.totalQuestions) * 100 : 0,
          courseTitle: course?.title || 'Unknown Course',
        };
        quizAttemptsStore.push(newAttempt);
        saveQuizAttemptsToLocalStorage();
        resolve(newAttempt);
      }, SIMULATED_DELAY);
    });
  },

  getQuizAttemptsForUser: (userId: string): Promise<QuizAttempt[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const attempts = quizAttemptsStore.filter(attempt => attempt.userId === userId);
        resolve(attempts.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()));
      }, SIMULATED_DELAY);
    });
  },

  getQuizAttemptsForInstructorQuizzes: (instructorId: string): Promise<QuizAttempt[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const instructorCourses = coursesStore.filter(c => c.instructorId === instructorId);
            const instructorCourseIds = instructorCourses.map(c => c.id);
            
            const attempts = quizAttemptsStore.filter(attempt => instructorCourseIds.includes(attempt.courseId));
            resolve(attempts.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()));
        }, SIMULATED_DELAY);
    });
  }
};
