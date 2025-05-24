/*
  # Initial Schema for LearnSpark LMS

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text)
      - `email` (text, unique)
      - `role` (enum: student, instructor, admin)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `courses`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `instructor_id` (uuid, references users)
      - `image_url` (text)
      - `category` (text)
      - `rating` (decimal)
      - `enrollment_count` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `lessons`
      - `id` (uuid, primary key)
      - `course_id` (uuid, references courses)
      - `title` (text)
      - `type` (enum: video, document, presentation)
      - `content` (text)
      - `lesson_order` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `quizzes`
      - `id` (uuid, primary key)
      - `title` (text)
      - `course_id` (uuid, references courses)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `quiz_questions`
      - `id` (uuid, primary key)
      - `quiz_id` (uuid, references quizzes)
      - `text` (text)
      - `type` (text, default: mcq)
      - `question_order` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `quiz_question_options`
      - `id` (uuid, primary key)
      - `question_id` (uuid, references quiz_questions)
      - `text` (text)
      - `is_correct` (boolean)
      - `option_order` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `quiz_attempts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `player_nickname` (text)
      - `quiz_id` (uuid, references quizzes)
      - `quiz_title` (text)
      - `course_id` (uuid, references courses)
      - `course_title` (text)
      - `score` (integer)
      - `total_questions` (integer)
      - `percentage` (decimal)
      - `taken_at` (timestamp)
      - `is_quiz_with` (boolean)

    - `user_enrolled_courses`
      - `user_id` (uuid, references users)
      - `course_id` (uuid, references courses)
      - `enrolled_at` (timestamp)

    - `active_quiz_with_sessions`
      - `pin` (text, primary key)
      - `quiz_id` (uuid, references quizzes)
      - `course_id` (uuid, references courses)
      - `host_user_id` (uuid, references users)
      - `status` (enum: waiting, active, finished)
      - `quiz_title` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin');
CREATE TYPE lesson_type AS ENUM ('video', 'document', 'presentation');
CREATE TYPE quiz_with_status AS ENUM ('waiting', 'active', 'finished');

-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructor_id uuid REFERENCES users ON DELETE CASCADE NOT NULL,
  image_url text,
  category text,
  rating decimal(3,2) DEFAULT 0.0,
  enrollment_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lessons table
CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  type lesson_type NOT NULL,
  content text,
  lesson_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quizzes table
CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  course_id uuid REFERENCES courses ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quiz_questions table
CREATE TABLE quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  type text DEFAULT 'mcq',
  question_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quiz_question_options table
CREATE TABLE quiz_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES quiz_questions ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  is_correct boolean DEFAULT false,
  option_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quiz_attempts table
CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users ON DELETE SET NULL,
  player_nickname text,
  quiz_id uuid REFERENCES quizzes ON DELETE CASCADE NOT NULL,
  quiz_title text,
  course_id uuid REFERENCES courses ON DELETE CASCADE NOT NULL,
  course_title text,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  percentage decimal(5,2) NOT NULL,
  taken_at timestamptz DEFAULT now(),
  is_quiz_with boolean DEFAULT false
);

-- Create user_enrolled_courses table
CREATE TABLE user_enrolled_courses (
  user_id uuid REFERENCES users ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses ON DELETE CASCADE NOT NULL,
  enrolled_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

-- Create active_quiz_with_sessions table
CREATE TABLE active_quiz_with_sessions (
  pin text PRIMARY KEY,
  quiz_id uuid REFERENCES quizzes ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses ON DELETE CASCADE NOT NULL,
  host_user_id uuid REFERENCES users ON DELETE CASCADE NOT NULL,
  status quiz_with_status DEFAULT 'waiting',
  quiz_title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_enrolled_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_quiz_with_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Create policies for courses table
CREATE POLICY "Anyone can view courses" ON courses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Instructors can create courses" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'instructor'
  ));

CREATE POLICY "Instructors can update their own courses" ON courses
  FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

-- Create policies for lessons table
CREATE POLICY "Anyone can view lessons" ON lessons
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Instructors can manage lessons for their courses" ON lessons
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.instructor_id = auth.uid()
  ));

-- Create policies for quizzes and related tables
CREATE POLICY "Anyone can view quizzes" ON quizzes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Instructors can manage quizzes for their courses" ON quizzes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = quizzes.course_id AND courses.instructor_id = auth.uid()
  ));

-- Similar policies for quiz questions and options
CREATE POLICY "Anyone can view quiz questions" ON quiz_questions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can view quiz options" ON quiz_question_options
  FOR SELECT TO authenticated
  USING (true);

-- Create policies for quiz attempts
CREATE POLICY "Users can view their own attempts" ON quiz_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM courses WHERE courses.id = quiz_attempts.course_id AND courses.instructor_id = auth.uid()
  ));

CREATE POLICY "Users can create quiz attempts" ON quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Create policies for user enrollments
CREATE POLICY "Users can view their enrollments" ON user_enrolled_courses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM courses WHERE courses.id = user_enrolled_courses.course_id AND courses.instructor_id = auth.uid()
  ));

CREATE POLICY "Users can enroll in courses" ON user_enrolled_courses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create policies for quiz sessions
CREATE POLICY "Anyone can view active quiz sessions" ON active_quiz_with_sessions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Instructors can manage quiz sessions" ON active_quiz_with_sessions
  FOR ALL TO authenticated
  USING (host_user_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON quiz_questions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_quiz_question_options_updated_at
  BEFORE UPDATE ON quiz_question_options
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_active_quiz_with_sessions_updated_at
  BEFORE UPDATE ON active_quiz_with_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();