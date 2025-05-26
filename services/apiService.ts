
import { createClient, SupabaseClient, AuthUser as SupabaseAuthUser, AuthSession as SupabaseSession, PostgrestError, AuthError, RealtimeChannel } from '@supabase/supabase-js';
import { User, Course, Quiz, Lesson, QuizAttempt, UserRole, ActiveQuizWithSession, QuizQuestion, QuizQuestionOption, QuizWithLiveAnswerPayload, CourseRating, UserCourseRating } from '../types';

// Vite uses import.meta.env for environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("YOUR_SUPABASE_URL") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")) {
  const errorMessage =
    "FATAL ERROR: Supabase URL or Anon Key is not configured. " +
    "Please create a .env file in the project root and add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. " +
    "For deployment, set these as environment variables. " +
    "The application cannot function without valid Supabase credentials.";

  console.error(errorMessage);

  const displayErrorOnPage = () => {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.innerHTML = `
            <div style="padding: 20px; font-family: sans-serif; background-color: #ffebee; border: 2px solid #c62828; color: #c62828; margin: 20px; border-radius: 8px;">
                <h1 style="color: #c62828; font-size: 24px; margin-bottom: 15px;">Application Configuration Error</h1>
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

  throw new Error("Supabase credentials are not configured correctly. See console and page for details. App cannot start.");

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
    console.error(customMessage || 'Supabase Error:', error.message, error);
    throw new Error(customMessage || `Database error: ${error.message}`);
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
    const { data, error } = await supabase.from('courses').select('*, enrollment_count').order('created_at', { ascending: false });
    handleSupabaseError({ error, customMessage: "Failed to fetch courses." });
    return mapToAppType(data || []) as Course[];
  },

  getCourseById: async (courseId: string): Promise<Course | null> => {
    const { data, error } = await supabase
      .from('courses')
      .select('*, enrollment_count, lessons(*, id, title, type, content, order_index), quizzes(*, id, title)') 
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

    if (!instructorId) { // If instructorId not passed, verify ownership
        const { data: courseOwner, error: ownerError } = await supabase.from('courses').select('instructor_id').eq('id', courseId).single();
        handleSupabaseError({ error: ownerError });
        if (!courseOwner || courseOwner.instructor_id !== currentUserId) throw new Error("Not authorized to add lesson to this course.");
    }
    const supabaseLessonData = mapToSupabaseType({ ...lessonData, courseId });
    delete supabaseLessonData.id; // Ensure no ID is passed for insert
    const { data, error } = await supabase.from('lessons').insert(supabaseLessonData).select().single();
    handleSupabaseError({ error, customMessage: `Failed to add lesson ${lessonData.title}` });
    if (data) {
        return mapToAppType(data) as Lesson;
    }
    return null;
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
    
    return mappedData as Quiz;
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
        // FIX: Ensure function continues or throws appropriately if newQuestionData is null
        if (!newQuestionData) {
          throw new Error(`Critical error: Question '${qApp.text}' insert failed to return data, though Supabase reported no error.`);
        }

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
    
    const coursesRelation = existingQuizData.courses as ({ instructor_id: string }[] | { instructor_id: string } | null);
    let courseInstructorId: string | undefined;

    if (Array.isArray(coursesRelation)) {
      if (coursesRelation.length > 0 && coursesRelation[0]) {
        courseInstructorId = coursesRelation[0].instructor_id;
      }
    } else if (coursesRelation) { 
      courseInstructorId = coursesRelation.instructor_id;
    }
    
    if (!courseInstructorId || courseInstructorId !== currentUser.id) {
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
          if (!newQuestionData) {
            throw new Error(`Failed to insert question ${qApp.text}, no data returned after insert.`);
          }
          
          if (optionsApp && optionsApp.length > 0) {
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
        questionCount: (q.quiz_questions && q.quiz_questions.length > 0 && q.quiz_questions[0] !== undefined) ? q.quiz_questions[0].count : 0,
        questions: [] 
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
    const { data, error } = await supabase.from('enrollments').select('courses(*, enrollment_count)').eq('user_id', currentUser.id);
    handleSupabaseError({ error, customMessage: "Failed to fetch enrolled courses." });
    return data ? mapToAppType(data.map(e => e.courses)) as Course[] : [];
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) return [];
    const { data, error } = await supabase.from('courses').select('*, enrollment_count').eq('instructor_id', currentUser.id);
    handleSupabaseError({ error, customMessage: "Failed to fetch created courses." });
    return mapToAppType(data || []) as Course[];
  },
  getEnrollmentCountForCourse: async (courseId: string): Promise<number> => {
    const { data, error, count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 (no rows found) is not an error for a count.
        handleSupabaseError({ error, customMessage: `Failed to get enrollment count for course ${courseId}.` });
    }
    return count ?? 0;
  },

  // --- Course Ratings & Reviews ---
  getCourseRatingsWithUserDetails: async (courseId: string): Promise<UserCourseRating[]> => {
    const { data, error } = await supabase
        .from('course_ratings')
        .select('id, course_id, user_id, rating, review_text, created_at, updated_at') 
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
    handleSupabaseError({ error, customMessage: "Failed to fetch course ratings."});
    if (!data) return [];
    
    return data.map(r => {
        const mappedRating = mapToAppType(r) as UserCourseRating;
        return mappedRating;
    });
  },
  getUserCourseRating: async (courseId: string, userId: string): Promise<CourseRating | null> => {
    const { data, error } = await supabase
        .from('course_ratings')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .maybeSingle(); 
    handleSupabaseError({ error }); 
    return data ? mapToAppType(data) as CourseRating : null;
  },
  submitCourseRating: async (courseId: string, rating: number, reviewText?: string): Promise<CourseRating> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated to submit rating.");

    const ratingData = {
        course_id: courseId,
        user_id: currentUser.id,
        rating: rating,
        review_text: reviewText || null,
    };
    const { data, error } = await supabase
        .from('course_ratings')
        .upsert(ratingData, { onConflict: 'user_id, course_id' }) 
        .select()
        .single();
    handleSupabaseError({ error, customMessage: "Failed to submit course rating." });
    if (!data) throw new Error("Failed to submit rating, no data returned.");
        
    return mapToAppType(data) as CourseRating;
  },
  getRatingsCountForCourse: async (courseId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('course_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);
    
    if (error && error.code !== 'PGRST116') {
        handleSupabaseError({ error, customMessage: `Failed to get ratings count for course ${courseId}.` });
    }
    return count ?? 0;
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
        delete (appAttempt as any).quizzes;
        delete (appAttempt as any).courses;
        return appAttempt;
    });
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) return [];
    // Fetch courses first, then quizzes for those courses.
    const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, quizzes(*, quiz_questions(count))')
        .eq('instructor_id', currentUser.id);
    handleSupabaseError({ error: coursesError, customMessage: "Failed to fetch instructor's courses for quizzes." });
    if (!coursesData) return [];
    
    const quizzes: Quiz[] = coursesData.flatMap(course => {
        if (!course.quizzes) return [];
        return mapToAppType(course.quizzes.map((q: any) => ({
            ...q, 
            questionCount: (q.quiz_questions && q.quiz_questions.length > 0 && q.quiz_questions[0]) ? q.quiz_questions[0].count : 0,
            courseId: course.id // Ensure courseId is part of the quiz object
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
    const { data, error } = await supabase.from('quiz_attempts')
      .select('*, quizzes(title), courses(title)') 
      .in('course_id', courseIds).order('taken_at', { ascending: false });
    handleSupabaseError({ error, customMessage: "Failed to fetch quiz attempts for instructor." });
    if (!data) return [];
    return data.map(attempt => {
        const appAttempt = mapToAppType(attempt) as QuizAttempt;
        appAttempt.quizTitle = (attempt.quizzes as any)?.title || 'N/A';
        appAttempt.courseTitle = (attempt.courses as any)?.title || 'N/A';
        delete (appAttempt as any).quizzes;
        delete (appAttempt as any).courses;
        return appAttempt;
    });
  },
  getEnrolledStudentsForCourse: async (courseId: string): Promise<User[]> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) {
      throw new Error("User not authenticated or not an instructor.");
    }

    const { data: courseData, error: courseFetchError } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();
    handleSupabaseError({ error: courseFetchError, customMessage: "Failed to fetch course for student list verification." });
    if (!courseData) throw new Error("Course not found.");
    if (courseData.instructor_id !== currentUser.id) {
      throw new Error("User not authorized to view students for this course.");
    }

    const { data: studentsData, error: rpcError } = await supabase.rpc('get_students_for_course', {
      course_id_param: courseId
    });

    handleSupabaseError({ error: rpcError as any, customMessage: "Failed to fetch enrolled students via RPC." });
    if (!studentsData) return [];
    
    return studentsData.map((student: any) => {
        const appStudent = mapToAppType(student) as User;
        appStudent.role = student.role as UserRole; 
        appStudent.email = student.email; // Ensure email is mapped from RPC
        return appStudent;
    });
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
    const currentUser = await apiService.getCurrentUser();
    if (!currentUser || currentUser.role !== UserRole.INSTRUCTOR) throw new Error("Only instructors can host.");
    const { error: qError, count } = await supabase.from('quiz_questions').select('id', {count: 'exact', head: true}).eq('quiz_id', quizId);
    handleSupabaseError({error: qError, customMessage: "Failed to check quiz questions."});
    if(count === null || count === 0) throw new Error("Cannot host QuizWith: Quiz has no questions.");
    
    let retries = 5;
    while(retries > 0) {
        const pin = Math.floor(100000 + Math.random() * 900000).toString(); 
        const { data, error } = await supabase.from('quizwith_sessions')
          .insert({ pin, quiz_id: quizId, host_user_id: currentUser.id, status: 'waiting' }).select('id, pin').single();
        
        if (error && error.message.includes('duplicate key value violates unique constraint "quizwith_sessions_pin_key"')) {
            retries--;
            if(retries === 0) throw new Error("Failed to generate unique PIN after multiple retries.");
            continue; 
        }
        handleSupabaseError({ error, customMessage: "Failed to host QuizWith session." });
        if (!data) throw new Error("Failed to host QuizWith session, no data returned.");
        return { pin: data.pin, sessionId: data.id };
    }
    throw new Error("Failed to generate a unique PIN for the QuizWith session."); 
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
    const { data: sessionData, error: sessionError } = await supabase.from('quizwith_sessions')
      .select('id, quiz_id, status, quizzes(course_id)').eq('pin', pin.toUpperCase()).single(); 
    if (sessionError && sessionError.code !== 'PGRST116') {
        handleSupabaseError({error: sessionError, customMessage: "Error validating PIN."});
    }
    if (!sessionData) return { success: false, message: 'Invalid or expired PIN.' };
    if (sessionData.status !== 'waiting') return { success: false, message: 'Session not accepting new players.' };
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
  subscribeToLiveAnswers: (quizWithSessionId: string, callback: (payload: QuizWithLiveAnswerPayload) => void): RealtimeChannel => {
    const channel = supabase.channel(`quizwith-session-${quizWithSessionId}`);
    channel
      .on('broadcast', { event: 'student_answer' }, (message) => {
        callback(message.payload as QuizWithLiveAnswerPayload);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to live answers for session ${quizWithSessionId}`);
        }
        if (err) {
          console.error(`Error subscribing to live answers for session ${quizWithSessionId}:`, err);
        }
      });
    return channel;
  },
  unsubscribeFromLiveAnswers: async (channel: RealtimeChannel): Promise<string | void> => {
    return supabase.removeChannel(channel);
  },
  broadcastStudentAnswer: async (quizWithSessionId: string, payload: QuizWithLiveAnswerPayload): Promise<void> => {
    const channel = supabase.channel(`quizwith-session-${quizWithSessionId}`); 
    const status = await channel.send({
      type: 'broadcast',
      event: 'student_answer',
      payload: payload,
    });
    if (status !== 'ok') {
        console.error("Failed to broadcast student answer, status:", status);
    }
  },
};