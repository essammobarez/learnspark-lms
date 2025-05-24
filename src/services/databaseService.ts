import { supabase } from '../lib/supabase';
import { User, Course, Lesson, Quiz, QuizQuestion, QuizAttempt, UserRole, ActiveQuizWithSession } from '../types';

export const databaseService = {
  // User Operations
  login: async (email: string, password: string) => {
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    if (!user) return null;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return userData;
  },

  signup: async (username: string, email: string, password: string, role: UserRole) => {
    const { data: { user }, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, role }
      }
    });

    if (authError) throw authError;
    if (!user) return { success: false, message: 'Signup failed' };

    const { error: userError } = await supabase
      .from('users')
      .insert([{ id: user.id, username, email, role }]);

    if (userError) throw userError;

    return { success: true, message: 'Signup successful! Please log in.' };
  },

  // Course Operations
  getCourses: async () => {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:users(username)
      `);
    
    if (error) throw error;
    return data || [];
  },

  getCourseById: async (courseId: string) => {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:users(username),
        lessons(*),
        quizzes(id)
      `)
      .eq('id', courseId)
      .single();
    
    if (error) throw error;
    return data;
  },

  createCourse: async (courseData: Partial<Course>) => {
    const { data, error } = await supabase
      .from('courses')
      .insert([courseData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  updateCourse: async (courseId: string, courseData: Partial<Course>) => {
    const { data, error } = await supabase
      .from('courses')
      .update(courseData)
      .eq('id', courseId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Lesson Operations
  addLesson: async (lessonData: Partial<Lesson>) => {
    const { data, error } = await supabase
      .from('lessons')
      .insert([lessonData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Quiz Operations
  getQuizById: async (quizId: string) => {
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        questions:quiz_questions(
          *,
          options:quiz_question_options(*)
        )
      `)
      .eq('id', quizId)
      .single();
    
    if (quizError) throw quizError;
    return quiz;
  },

  createQuiz: async (quizData: Partial<Quiz>) => {
    const { data, error } = await supabase
      .from('quizzes')
      .insert([quizData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Enrollment Operations
  enrollInCourse: async (userId: string, courseId: string) => {
    const { error } = await supabase
      .from('user_enrolled_courses')
      .insert([{ user_id: userId, course_id: courseId }]);
    
    if (error) throw error;
    return true;
  },

  getEnrolledCourses: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_enrolled_courses')
      .select(`
        course:courses(
          *,
          instructor:users(username)
        )
      `)
      .eq('user_id', userId);
    
    if (error) throw error;
    return data?.map(item => item.course) || [];
  },

  getCreatedCourses: async (userId: string) => {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:users(username)
      `)
      .eq('instructor_id', userId);
    
    if (error) throw error;
    return data || [];
  },

  // Quiz Attempt Operations
  submitQuizScore: async (attemptData: Partial<QuizAttempt>) => {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert([attemptData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  getQuizAttemptsForUser: async (userId: string) => {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('taken_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  getQuizAttemptsForInstructorQuizzes: async (instructorId: string) => {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        course:courses(instructor_id)
      `)
      .eq('course.instructor_id', instructorId)
      .order('taken_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Quiz With Session Operations
  createQuizWithSession: async (sessionData: Partial<ActiveQuizWithSession>) => {
    const { data, error } = await supabase
      .from('active_quiz_with_sessions')
      .insert([sessionData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  getQuizWithSession: async (pin: string) => {
    const { data, error } = await supabase
      .from('active_quiz_with_sessions')
      .select('*')
      .eq('pin', pin)
      .single();
    
    if (error) throw error;
    return data;
  },

  updateQuizWithSession: async (pin: string, status: 'waiting' | 'active' | 'finished') => {
    const { data, error } = await supabase
      .from('active_quiz_with_sessions')
      .update({ status })
      .eq('pin', pin)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};