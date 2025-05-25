import { createClient } from '@supabase/supabase-js';
import { User, Course, Quiz, Lesson, QuizAttempt, UserRole, ActiveQuizWithSession } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const handleSupabaseError = (error: unknown, operation: string) => {
  console.error(`Supabase Error (${operation}):`, error);
  if (error instanceof Error) {
    throw new Error(`${operation} failed: ${error.message}`);
  }
  throw error;
};

export const apiService = {
  // --- Auth ---
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      if (!data.session || !data.user) throw new Error('Login failed');

      // Get additional user data from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User data not found');

      return {
        token: data.session.access_token,
        user: {
          id: parseInt(userData.id),
          username: userData.username,
          email: userData.email,
          role: userData.role,
          enrolledCourseIds: [],
          createdCourseIds: [],
        },
      };
    } catch (error) {
      return handleSupabaseError(error, 'Login');
    }
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          lessons (*),
          quizzes (id)
        `)
        .order('createdat', { ascending: false });

      if (error) throw error;

      return data.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        instructorId: course.instructorid,
        instructorName: course.instructorname,
        imageUrl: course.imageurl,
        category: course.category,
        rating: course.rating || 0,
        enrollmentCount: course.enrollmentcount || 0,
        lessons: course.lessons || [],
        quizIds: (course.quizzes || []).map(q => q.id),
        createdAt: course.createdat,
        updatedAt: course.updatedat
      }));
    } catch (error) {
      return handleSupabaseError(error, 'Get Courses');
    }
  },

  // Add other methods here following the same pattern...
};