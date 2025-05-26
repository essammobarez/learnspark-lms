
import { createClient, SupabaseClient, AuthUser as SupabaseAuthUser, AuthSession as SupabaseSession, PostgrestError, AuthError } from '@supabase/supabase-js';
import { User, Course, Quiz, Lesson, QuizAttempt, UserRole, ActiveQuizWithSession, QuizQuestion, QuizQuestionOption } from '../../types'; // Adjusted path

// Vite uses import.meta.env for environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("YOUR_SUPABASE_URL") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")) {
  const errorMessage =
    "FATAL ERROR (src/services/apiService.ts): Supabase URL or Anon Key is not configured. " +
    "Please create a .env file in the project root and add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. " +
    "For deployment, set these as environment variables. " +
    "The application cannot function without valid Supabase credentials.";

  console.error(errorMessage);

  const displayErrorOnPage = () => {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.innerHTML = `
            <div style="padding: 20px; font-family: sans-serif; background-color: #ffebee; border: 2px solid #c62828; color: #c62828; margin: 20px; border-radius: 8px;">
                <h1 style="color: #c62828; font-size: 24px; margin-bottom: 15px;">Application Configuration Error (from src/services)</h1>
                <p style="font-size: 16px; line-height: 1.6;"><strong>${errorMessage.split('.')[0]}.</strong></p>
                <p style="font-size: 16px; line-height: 1.6;">Please refer to the console error message for instructions on setting up your <code>.env</code> file or deployment environment variables.</p>
                <p style="font-size: 16px; line-height: 1.6;">The application cannot function until this is corrected.</p>
            </div>
        `;
    } else {
        alert(errorMessage);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', displayErrorOnPage);
  } else {
    displayErrorOnPage();
  }

  throw new Error("Supabase credentials are not configured correctly (src/services/apiService.ts). See console and page for details. App cannot start.");

} else {
  supabaseInstance = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

export const supabase: SupabaseClient = supabaseInstance;


// --- Data Mapping Helpers ---
function toCamelCase(str: string): string {
  return str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, (match, letter, offset) => {
    return (offset > 0 ? '_' : '') + letter.toLowerCase();
  }).replace(/^_/, ''); 
}


function mapKeys(obj: any, mappingFn: (key: string) => string): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(item => mapKeys(item, mappingFn));
  return Object.keys(obj).reduce((acc, key) => {
    acc[mappingFn(key)] = mapKeys(obj[key], mappingFn); 
    return acc;
  }, {} as any);
}

const mapToAppType = (data: any): any => mapKeys(data, toCamelCase);
const mapToSupabaseType = (data: any): any => mapKeys(data, toSnakeCase);

// --- Error Handling Helper ---
function handleSupabaseError({ error, customMessage }: { error: PostgrestError | AuthError | null, customMessage?: string }): void {
  if (error) {
    if (error.code === 'PGRST116' && !customMessage) {
        return; 
    }
    console.error(customMessage || 'Supabase Error (from src/services):', error.message, error);
    throw new Error(customMessage || `Database error (src/services): ${error.message}`);
  }
}

const mapSupabaseUserToAppUser = (supabaseUser: SupabaseAuthUser | null, _session: SupabaseSession | null): User | null => {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    username: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || 'Guest',
    role: supabaseUser.user_metadata?.role || UserRole.STUDENT,
  };
};


export const apiService = {
  // --- Auth ---
  login: async (email: string, password_unused: string): Promise<{ token: string; user: User }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: password_unused });
    handleSupabaseError({ error, customMessage: 'Login failed: Invalid login credentials' });
    if (!data.session || !data.user) throw new Error('Login failed: No session or user data returned from Supabase.');
    const appUser = mapSupabaseUserToAppUser(data.user, data.session);
    if (!appUser) throw new Error('Login failed: Could not map Supabase user to application user type.');
    return { token: data.session.access_token, user: appUser };
  },

  signup: async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: password_unused,
      options: { data: { username, role } }
    });
    if (error) return { success: false, message: error.message };
    if (!data.user) return { success: false, message: "Signup process initiated. If email confirmation is enabled, please check your email."};
    const appUser = mapSupabaseUserToAppUser(data.user, data.session);
    return { success: true, message: 'Signup successful! Check your email for confirmation if enabled.', user: appUser || undefined };
  },

  getCurrentUser: async (): Promise<User | null> => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) { console.error('Failed to get session:', sessionError); return null; }
    if (!session) return null;
    return mapSupabaseUserToAppUser(session.user, session);
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    handleSupabaseError({ error, customMessage: 'Logout failed' });
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    handleSupabaseError({ error, customMessage: "Failed to fetch courses." });
    return mapToAppType(data || []) as Course[];
  },

  getCourseById: async (courseId: string): Promise<Course | null> => {
    const { data, error } = await supabase
      .from('courses')
      .select('*, lessons(*, id, title, type, content, order_index), quizzes(*, id, title)') 
      .eq('id', courseId)
      .order('order_index', { foreignTable: 'lessons', ascending: true }) 
      .single();

    handleSupabaseError({ error }); 
    if (!data) return null; 

    const course = mapToAppType(data) as Course;
    if (course) {
        course.lessons = Array.isArray(course.lessons) ? course.lessons : [];
        const fetchedQuizzesData = Array.isArray((course as any).quizzes) ? (course as any).quizzes : [];
        course.quizIds = fetchedQuizzesData.map((q: any) => q.id);
        delete (course as any).quizzes; 
    } else {
        return null; 
    }
    return course;
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'>): Promise<Course> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated");

    const supabaseCourseData = mapToSupabaseType({
      ...courseData, instructorId: currentUser.id, instructorName: currentUser.username, rating: 0, enrollmentCount: 0,
    });
    const { lessons: appLessons, ...courseInsertData } = supabaseCourseData; 

    const { data: newCourseSupabase, error: courseInsertError } = await supabase.from('courses').insert(courseInsertData).select().single();
    handleSupabaseError({ error: courseInsertError, customMessage: "Failed to create course." });
    if (!newCourseSupabase) throw new Error("Failed to create course, no data returned from insert.");

    let createdLessons: Lesson[] = [];
    if (appLessons && Array.isArray(appLessons) && appLessons.length > 0 && newCourseSupabase.id) {
        const lessonsToInsert = appLessons.map((lesson: any, index: number) => {
            const { id: tempId, ...lessonContent } = lesson; 
            return { ...lessonContent, course_id: newCourseSupabase.id, order_index: index };
        });
        const { data: insertedLessonsData, error: lessonsInsertError } = await supabase.from('lessons').insert(lessonsToInsert).select();
        handleSupabaseError({ error: lessonsInsertError, customMessage: "Failed to create lessons." });
        createdLessons = mapToAppType(insertedLessonsData || []) as Lesson[];
    }
    const appCourse = mapToAppType(newCourseSupabase) as Course;
    appCourse.lessons = createdLessons;
    appCourse.quizIds = [];
    return appCourse;
  },

  updateCourse: async (courseId: string, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>>): Promise<Course | null> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated");

    const { data: existingCourse, error: fetchError } = await supabase.from('courses').select('instructor_id').eq('id', courseId).single();
    handleSupabaseError({ error: fetchError }); 
    if (!existingCourse) throw new Error("Course not found.");
    if (existingCourse.instructor_id !== currentUser.id) throw new Error("User not authorized to update this course.");

    const { lessons: newLessonsDataFromApp, ...courseUpdatePayloadApp } = courseData;
    const supabaseCourseUpdatePayload = mapToSupabaseType(courseUpdatePayloadApp);

    const { data: updatedCourseSupabase, error: courseUpdateError } = await supabase.from('courses').update(supabaseCourseUpdatePayload).eq('id', courseId).select().single();
    handleSupabaseError({ error: courseUpdateError, customMessage: "Failed to update course details." });
    if (!updatedCourseSupabase) return null;

    if (newLessonsDataFromApp && Array.isArray(newLessonsDataFromApp)) {
        await supabase.from('lessons').delete().eq('course_id', courseId); 
        if (newLessonsDataFromApp.length > 0) {
            const lessonsToInsert = newLessonsDataFromApp.map((lesson, index) => {
                 const { id, ...lessonContent } = lesson; 
                 return { ...mapToSupabaseType(lessonContent), course_id: courseId, order_index: index };
            });
            const { error: lessonsInsertError } = await supabase.from('lessons').insert(lessonsToInsert);
            handleSupabaseError({ error: lessonsInsertError, customMessage: "Failed to insert updated lessons."});
        }
    }
    return apiService.getCourseById(courseId);
  },

  addLessonToCourse: async (courseId: string, lessonData: Omit<Lesson, 'id'>, instructorId?: string): Promise<Lesson | null> => {
    const currentUserId = instructorId || (await apiService.getCurrentUser())?.id;
    if (!currentUserId) throw new Error("User not authenticated for adding lesson");

    if (!instructorId) {
        const { data: courseOwner, error: ownerError } = await supabase.from('courses').select('instructor_id').eq('id', courseId).single();
        handleSupabaseError({ error: ownerError });
        if (!courseOwner || courseOwner.instructor_id !== currentUserId) throw new Error("Not authorized to add lesson to this course.");
    }
    const supabaseLessonData = mapToSupabaseType({ ...lessonData, courseId });
    delete supabaseLessonData.id;
    const { data, error } = await supabase.from('lessons').insert(supabaseLessonData).select().single();
    handleSupabaseError({ error, customMessage: `Failed to add lesson ${lessonData.title}` });
    return data ? mapToAppType(data) as Lesson : null;
  },

  // --- Quizzes ---
  getQuizById: async (quizId: string): Promise<Quiz | null> => {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, quiz_questions(*, quiz_options(*, id, text, is_correct))')
      .eq('id', quizId)
      .order('order_index', { foreignTable: 'quiz_questions', ascending: true })
      .order('id', { foreignTable: 'quiz_questions.quiz_options', ascending: true })
      .single();

    handleSupabaseError({ error }); 
    if (!data) return null; 

    const mappedData = mapToAppType(data);
    if (!mappedData) return null;

    if (mappedData.hasOwnProperty('quizQuestions')) {
        mappedData.questions = mappedData.quizQuestions;
        delete mappedData.quizQuestions;
    }

    mappedData.questions = Array.isArray(mappedData.questions) ? mappedData.questions : [];
    mappedData.questions.forEach((question: any) => { 
        if (question && question.hasOwnProperty('quizOptions')) {
            question.options = question.quizOptions;
            delete question.quizOptions;
        }
        if(question) { 
            question.options = Array.isArray(question.options) ? question.options : [];
        }
    });
    
    const appQuiz = mappedData as Quiz;
    return appQuiz;
  },

  createQuiz: async (quizData: Omit<Quiz, 'id'>): Promise<Quiz> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated for creating quiz");

    const { data: course, error: courseError } = await supabase.from('courses').select('instructor_id').eq('id', quizData.courseId).single();
    handleSupabaseError({ error: courseError });
    if (!course) throw new Error("Course not found.");
    if (course.instructor_id !== currentUser.id) throw new Error("User not authorized to create quiz for this course.");

    const { questions, ...quizDetailsApp } = quizData;
    const supabaseQuizDetails = mapToSupabaseType(quizDetailsApp);

    const { data: newQuizSupabase, error: quizInsertError } = await supabase.from('quizzes').insert(supabaseQuizDetails).select().single();
    handleSupabaseError({ error: quizInsertError, customMessage: `Failed to create quiz: ${quizData.title}` });
    if (!newQuizSupabase) throw new Error("Failed to create quiz, no data returned from insert.");

    const createdQuestions: QuizQuestion[] = [];
    if (questions && questions.length > 0) {
      for (const [qIndex, qApp] of questions.entries()) {
        const { options: optionsApp, id: tempQId, ...questionDetailsApp } = qApp;
        const supabaseQuestionDetails = mapToSupabaseType(questionDetailsApp);
        const questionToInsert = { ...supabaseQuestionDetails, quiz_id: newQuizSupabase.id, order_index: qIndex };

        const { data: newQuestionData, error: qError } = await supabase.from('quiz_questions').insert(questionToInsert).select().single();
        handleSupabaseError({ error: qError, customMessage: `Failed to create question: ${qApp.text}` });
        if (!newQuestionData) continue; 

        const createdOptions: QuizQuestionOption[] = [];
        if (optionsApp && optionsApp.length > 0) {
          const optionsToInsert = optionsApp.map(optApp => {
            const { id: tempOptId, ...optionContentApp } = optApp; 
            const supabaseOptionContent = mapToSupabaseType(optionContentApp);
            return { ...supabaseOptionContent, question_id: newQuestionData.id };
          });
          const { data: newOptionsData, error: oError } = await supabase.from('quiz_options').insert(optionsToInsert).select();
          handleSupabaseError({ error: oError, customMessage: `Failed to create options for question: ${qApp.text}` });
          if (newOptionsData) createdOptions.push(...mapToAppType(newOptionsData) as QuizQuestionOption[]);
        }
        createdQuestions.push({ ...mapToAppType(newQuestionData), options: createdOptions } as QuizQuestion);
      }
    }
    return { ...mapToAppType(newQuizSupabase), questions: createdQuestions } as Quiz;
  },

  updateQuiz: async (quizIdToUpdate: string, quizData: Partial<Omit<Quiz, 'id' | 'courseId'>>): Promise<Quiz | null> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) {
      throw new Error("User not authenticated or not an instructor.");
    }

    const { data: existingQuizData, error: fetchQuizError } = await supabase
      .from('quizzes')
      .select('course_id, courses(instructor_id)')
      .eq('id', quizIdToUpdate)
      .single();

    handleSupabaseError({ error: fetchQuizError, customMessage: "Failed to fetch quiz for update verification." });
    if (!existingQuizData) throw new Error("Quiz to update not found.");
    if (!existingQuizData.courses || (existingQuizData.courses as any).instructor_id !== currentUser.id) {
      throw new Error("User not authorized to update this quiz.");
    }

    const { title: newTitleApp, questions: newQuestionsApp } = quizData;

    try {
      if (newTitleApp) {
        const { error: titleUpdateError } = await supabase
          .from('quizzes')
          .update(mapToSupabaseType({ title: newTitleApp }))
          .eq('id', quizIdToUpdate);
        handleSupabaseError({ error: titleUpdateError, customMessage: "Failed to update quiz title." });
      }

      if (newQuestionsApp && Array.isArray(newQuestionsApp)) {
        const { data: oldQuestionIdsData, error: fetchOldQError } = await supabase
          .from('quiz_questions')
          .select('id')
          .eq('quiz_id', quizIdToUpdate);
        handleSupabaseError({ error: fetchOldQError, customMessage: "Failed to fetch old question IDs." });
        
        const oldQuestionIds = oldQuestionIdsData?.map(q => q.id) || [];

        if (oldQuestionIds.length > 0) {
           const { error: deleteOldOptionsError } = await supabase
             .from('quiz_options')
             .delete()
             .in('question_id', oldQuestionIds);
           handleSupabaseError({ error: deleteOldOptionsError, customMessage: "Failed to delete old options." });
        }

        const { error: deleteOldQuestionsError } = await supabase
          .from('quiz_questions')
          .delete()
          .eq('quiz_id', quizIdToUpdate);
        handleSupabaseError({ error: deleteOldQuestionsError, customMessage: "Failed to delete old questions." });

        for (const [qIndex, qApp] of newQuestionsApp.entries()) {
          const { options: optionsApp, id: tempQId, ...questionDetailsApp } = qApp;
          const supabaseQuestionDetails = mapToSupabaseType(questionDetailsApp);
          const questionToInsert = { ...supabaseQuestionDetails, quiz_id: quizIdToUpdate, order_index: qIndex };

          const { data: newQuestionData, error: qInsertError } = await supabase
            .from('quiz_questions')
            .insert(questionToInsert)
            .select('id')
            .single();
          handleSupabaseError({ error: qInsertError, customMessage: `Failed to insert new question: ${qApp.text}` });
          
          if (newQuestionData && optionsApp && optionsApp.length > 0) {
            const optionsToInsert = optionsApp.map(optApp => {
              const { id: tempOptId, ...optionContentApp } = optApp;
              const supabaseOptionContent = mapToSupabaseType(optionContentApp);
              return { ...supabaseOptionContent, question_id: newQuestionData.id };
            });
            const { error: oInsertError } = await supabase.from('quiz_options').insert(optionsToInsert);
            handleSupabaseError({ error: oInsertError, customMessage: `Failed to insert options for question: ${qApp.text}` });
          }
        }
      }
      return apiService.getQuizById(quizIdToUpdate);
    } catch (error) {
      console.error("Error during quiz update process, data might be inconsistent:", error);
      if (error instanceof Error) throw error;
      throw new Error("An unexpected error occurred during quiz update.");
    }
  },

  getQuizzesForCourse: async (courseId: string): Promise<Quiz[]> => {
    const { data, error } = await supabase.from('quizzes')
      .select('*, quiz_questions(count)') 
      .eq('course_id', courseId)
      .order('created_at', { ascending: true });
    handleSupabaseError({ error, customMessage: `Failed to fetch quizzes for course ${courseId}.` });
    if (!data) return [];
    return mapToAppType(data.map((q: any) => ({
        ...q,
        questions: q.quiz_questions && q.quiz_questions.length > 0 && q.quiz_questions[0] !== undefined ? q.quiz_questions[0] : { count: 0 } 
    }))) as Quiz[];
  },


  // --- Enrollments ---
  enrollInCourse: async (courseId: string): Promise<{ success: boolean; message?: string }> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) return { success: false, message: "User not authenticated" };

    const { data: existingEnrollment, error: checkError } = await supabase
      .from('enrollments').select('id').eq('user_id', currentUser.id).eq('course_id', courseId).maybeSingle(); 
    handleSupabaseError({ error: checkError }); 
    if (existingEnrollment) return { success: false, message: "Already enrolled." };

    const { error: enrollError } = await supabase.from('enrollments').insert({ user_id: currentUser.id, course_id: courseId });
    handleSupabaseError({ error: enrollError, customMessage: "Enrollment failed."}); 

    const { error: updateCountError } = await supabase.rpc('increment_enrollment_count', { course_id_param: courseId });
    if (updateCountError) console.error("Failed to increment enrollment count:", updateCountError);
    return { success: true, message: 'Successfully enrolled!' };
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) return [];
    const { data, error } = await supabase.from('enrollments').select('courses(*)').eq('user_id', currentUser.id);
    handleSupabaseError({ error, customMessage: "Failed to fetch enrolled courses." });
    return data ? mapToAppType(data.map(e => e.courses)) as Course[] : [];
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) return [];
    const { data, error } = await supabase.from('courses').select('*').eq('instructor_id', currentUser.id);
    handleSupabaseError({ error, customMessage: "Failed to fetch created courses." });
    return mapToAppType(data || []) as Course[];
  },

  // --- Quiz Attempts & Reports ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage'>): Promise<QuizAttempt> => {
    const currentUser = await apiService.getCurrentUser(); 
    const userIdToStore = attemptData.isQuizWith ? (currentUser?.id || null) : (currentUser?.id);

    if (!userIdToStore && !attemptData.isQuizWith) throw new Error("User must be logged in for non-QuizWith attempts.");
    if (!userIdToStore && attemptData.isQuizWith && !attemptData.playerNickname) throw new Error("Nickname required for guest QuizWith attempts.");

    const { quizTitle, courseTitle, ...restOfAttemptDataForSupabase } = attemptData;

    const supabaseAttemptData = mapToSupabaseType({
      ...restOfAttemptDataForSupabase, 
      userId: userIdToStore, 
      percentage: (attemptData.totalQuestions > 0 ? (attemptData.score / attemptData.totalQuestions) * 100 : 0),
      takenAt: new Date().toISOString(), 
    });
    if(!supabaseAttemptData.player_nickname) supabaseAttemptData.player_nickname = null;


    const { data, error } = await supabase.from('quiz_attempts').insert(supabaseAttemptData).select().single();
    handleSupabaseError({ error, customMessage: "Failed to submit quiz score." });
    if (!data) throw new Error("Failed to submit quiz score, no data returned.");

    const {data: courseD} = await supabase.from('courses').select('title').eq('id', attemptData.courseId).single();
    const {data: quizD} = await supabase.from('quizzes').select('title').eq('id', attemptData.quizId).single();

    const appAttempt = mapToAppType(data) as QuizAttempt;
    appAttempt.courseTitle = courseD?.title || 'Unknown Course';
    appAttempt.quizTitle = quizD?.title || 'Unknown Quiz'; 
    return appAttempt;
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) return [];
    const { data, error } = await supabase.from('quiz_attempts').select('*, quizzes(title), courses(title)')
      .eq('user_id', currentUser.id).order('taken_at', { ascending: false });
    handleSupabaseError({ error, customMessage: "Failed to fetch user's quiz attempts." });
    if (!data) return [];
    return data.map(attempt => {
        const appAttempt = mapToAppType(attempt) as QuizAttempt;
        appAttempt.quizTitle = (attempt.quizzes as any)?.title || 'N/A';
        appAttempt.courseTitle = (attempt.courses as any)?.title || 'N/A';
        return appAttempt;
    });
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) return [];
    const { data, error } = await supabase.from('courses').select('quizzes(*, quiz_questions(count))').eq('instructor_id', currentUser.id);
    handleSupabaseError({ error, customMessage: "Failed to fetch instructor's quizzes." });
    if (!data) return [];
    const quizzes: Quiz[] = data.flatMap(course => {
        if (!course.quizzes) return [];
        return mapToAppType(course.quizzes.map((q: any) => ({
            ...q, questionCount: q.quiz_questions && q.quiz_questions.length > 0 && q.quiz_questions[0] ? q.quiz_questions[0].count : 0
        }))) as Quiz[]; 
    });
    return quizzes;
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) return [];
    const { data: instructorCourses, error: coursesError } = await supabase.from('courses').select('id').eq('instructor_id', currentUser.id);
    handleSupabaseError({ error: coursesError, customMessage: "Failed to fetch instructor's courses for reports." });
    if (!instructorCourses || instructorCourses.length === 0) return [];
    const courseIds = instructorCourses.map(c => c.id);
    const { data, error } = await supabase.from('quiz_attempts').select('*, quizzes(title), courses(title), users(username, email)')
      .in('course_id', courseIds).order('taken_at', { ascending: false });
    handleSupabaseError({ error, customMessage: "Failed to fetch quiz attempts for instructor." });
    if (!data) return [];
    return data.map(attempt => {
        const appAttempt = mapToAppType(attempt) as QuizAttempt;
        appAttempt.quizTitle = (attempt.quizzes as any)?.title || 'N/A';
        appAttempt.courseTitle = (attempt.courses as any)?.title || 'N/A';
        if (!appAttempt.playerNickname && attempt.users) {
             appAttempt.playerNickname = (attempt.users as any).username || (attempt.users as any).email || 'Registered User';
        }
        delete (appAttempt as any).users; 
        return appAttempt;
    });
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) throw new Error("Only instructors can host.");
    const { error: qError, count } = await supabase.from('quiz_questions').select('id', {count: 'exact', head: true}).eq('quiz_id', quizId);
    handleSupabaseError({error: qError, customMessage: "Failed to check quiz questions."});
    if(count === 0) throw new Error("Cannot host QuizWith: Quiz has no questions.");
    const pin = Math.floor(100000 + Math.random() * 900000).toString(); 
    const { data, error } = await supabase.from('quizwith_sessions')
      .insert({ pin, quiz_id: quizId, host_user_id: currentUser.id, status: 'waiting' }).select('id, pin').single();
    if (error && error.message.includes('duplicate key value violates unique constraint "quizwith_sessions_pin_key"')) {
        return apiService.hostQuizWithSession(quizId); 
    }
    handleSupabaseError({ error, customMessage: "Failed to host QuizWith session." });
    if (!data) throw new Error("Failed to host QuizWith session, no data returned.");
    return { pin: data.pin, sessionId: data.id };
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
    const { data: sessionData, error: sessionError } = await supabase.from('quizwith_sessions')
      .select('id, quiz_id, status, quizzes(course_id)').eq('pin', pin.toUpperCase()).single();
    handleSupabaseError({error: sessionError});
    if (!sessionData) return { success: false, message: 'Invalid or expired PIN.' };
    if (sessionData.status !== 'waiting') return { success: false, message: 'Session not accepting players.' };
    return { success: true, message: 'Joined successfully!', quizId: sessionData.quiz_id, courseId: (sessionData.quizzes as any)?.course_id, sessionId: sessionData.id };
  },

  getQuizWithSessionByPin: async (pin: string): Promise<ActiveQuizWithSession | null> => {
    const { data, error } = await supabase.from('quizwith_sessions').select('*, quizzes(title, course_id)')
      .eq('pin', pin.toUpperCase()).single();
    handleSupabaseError({ error });
    if (!data) return null;
    const appSession = mapToAppType(data) as ActiveQuizWithSession;
    const tempQuizzesProperty = (appSession as any).quizzes; 
    if (tempQuizzesProperty) { 
        appSession.quizTitle = tempQuizzesProperty.title;
        appSession.courseId = tempQuizzesProperty.courseId; 
        delete (appSession as any).quizzes; 
    }
    return appSession;
  },
};
