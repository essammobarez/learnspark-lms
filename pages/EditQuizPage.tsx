
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import { generateQuizQuestionsWithGemini, isGeminiAvailable } from '../services/geminiService';
import { ROUTES } from '../constants';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { QuizQuestion, QuizQuestionOption, Course, UserRole, Quiz } from '../types';
import { TrashIcon, SparklesIcon, PlusIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const EditQuizPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [originalQuiz, setOriginalQuiz] = useState<Quiz | null>(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  
  // For adding/editing a single question
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<Array<Partial<QuizQuestionOption & { originalId?: string }>>>([{ text: '' }, { text: '' }]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null); // To track if we are editing an existing Q or adding new

  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const geminiReady = isGeminiAvailable();

  const [pageLoading, setPageLoading] = useState(true); 
  const [formSubmitting, setFormSubmitting] = useState(false); 
  const [formError, setFormError] = useState(''); 
  const [successMessage, setSuccessMessage] = useState('');

  const fetchQuizAndCourseData = useCallback(async () => {
    if (!isAuthenticated || !user || user.role !== UserRole.INSTRUCTOR) {
      navigate(ROUTES.LOGIN);
      return;
    }
    if (!courseId || !quizId) {
        setFormError("Course or Quiz ID is missing.");
        setPageLoading(false);
        return;
    }
    setPageLoading(true); setFormError(''); setSuccessMessage('');
    try {
        const [fetchedCourse, fetchedQuiz] = await Promise.all([
            apiService.getCourseById(courseId),
            apiService.getQuizById(quizId)
        ]);

        if (!fetchedCourse) throw new Error("Course not found.");
        if (fetchedCourse.instructorId !== user.id) throw new Error("You are not authorized to edit quizzes for this course.");
        setCourse(fetchedCourse);

        if (!fetchedQuiz) throw new Error("Quiz not found.");
        if (fetchedQuiz.courseId !== courseId) throw new Error("Quiz does not belong to this course.");
        
        setOriginalQuiz(fetchedQuiz);
        setTitle(fetchedQuiz.title);
        // Ensure questions and options have originalId for potential future diffing or stable key usage
        setQuestions(fetchedQuiz.questions.map(q => ({
            ...q, 
            options: q.options.map(opt => ({...opt, originalId: opt.id })) 
        })));

    } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to load quiz data.");
        console.error(err);
    }
    setPageLoading(false);
  }, [courseId, quizId, user, isAuthenticated, navigate]);
  
  useEffect(() => {
    fetchQuizAndCourseData();
  }, [fetchQuizAndCourseData]);

  const resetQuestionForm = () => {
    setCurrentQuestionText('');
    setCurrentOptions([{ text: '' }, { text: '' }]);
    setCorrectOptionIndex(null);
    setEditingQuestionId(null);
  };

  const handleAddOptionField = () => {
    if (currentOptions.length < 4) setCurrentOptions([...currentOptions, { text: '' }]);
  };
  const handleRemoveOptionField = (index: number) => {
    if (currentOptions.length > 2) {
        const newOptions = [...currentOptions]; newOptions.splice(index, 1); setCurrentOptions(newOptions);
        if (correctOptionIndex === index) setCorrectOptionIndex(null);
        else if (correctOptionIndex !== null && correctOptionIndex > index) setCorrectOptionIndex(correctOptionIndex - 1);
    }
  };
  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...currentOptions]; newOptions[index] = { ...newOptions[index], text }; setCurrentOptions(newOptions);
  };

  const handleSaveQuestion = () => { // Handles both Add New and Update Existing Question from form
    setFormError('');
    if (!currentQuestionText.trim()) { setFormError('Question text is required.'); return; }
    const filledOptions = currentOptions.filter(opt => opt.text && opt.text.trim());
    if (filledOptions.length < 2) { setFormError('At least two options with text are required.'); return; }
    if (correctOptionIndex === null || !currentOptions[correctOptionIndex]?.text?.trim()) { setFormError('Please select a valid correct answer from the filled options.'); return; }

    let finalCorrectIndex = -1;
    const validOptionsWithOriginalIndex = currentOptions.map((opt, originalIndex) => ({ ...opt, originalIndex})).filter(opt => opt.text && opt.text.trim());
    
    const finalOptions: QuizQuestionOption[] = validOptionsWithOriginalIndex.map((opt, newIndex) => {
        if(opt.originalIndex === correctOptionIndex) finalCorrectIndex = newIndex;
        return { 
            id: opt.originalId || `temp_opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // Keep originalId or generate temp
            text: opt.text!.trim(), 
            isCorrect: false 
        };
    });

    if(finalCorrectIndex === -1) { setFormError("Error determining correct answer. Please re-select."); return; }
    finalOptions[finalCorrectIndex].isCorrect = true;

    const newOrUpdatedQuestion: QuizQuestion = { 
      id: editingQuestionId || `temp_q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Keep originalId or generate temp
      text: currentQuestionText.trim(), 
      options: finalOptions, 
      type: 'mcq' 
    };

    if (editingQuestionId) { // Update existing question in the list
      setQuestions(questions.map(q => q.id === editingQuestionId ? newOrUpdatedQuestion : q));
    } else { // Add new question to the list
      setQuestions([...questions, newOrUpdatedQuestion]);
    }
    resetQuestionForm();
  };

  const handleEditQuestionFromList = (questionId: string) => {
    const questionToEdit = questions.find(q => q.id === questionId);
    if (questionToEdit) {
        setEditingQuestionId(questionToEdit.id);
        setCurrentQuestionText(questionToEdit.text);
        setCurrentOptions(questionToEdit.options.map(opt => ({text: opt.text, originalId: opt.id}))); // Preserve original IDs if they exist
        setCorrectOptionIndex(questionToEdit.options.findIndex(opt => opt.isCorrect));
        window.scrollTo({ top: document.getElementById('edit-question-form')?.offsetTop || 0, behavior: 'smooth' });
    }
  };
  
  const handleRemoveQuestionFromList = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
    if (editingQuestionId === questionId) resetQuestionForm(); // If deleting the question currently in form, reset form
  };
  
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim()) { setAiError("Please enter a topic for AI question generation."); return; }
    if (!geminiReady) { setAiError("Gemini AI is not available."); return; }
    setIsGeneratingWithAI(true); setAiError('');
    try {
      const aiQuestions = await generateQuizQuestionsWithGemini(aiTopic, 3); 
      // Add AI questions to the main questions list. Ensure they get temporary IDs.
      const newAiQuestions = aiQuestions.map(q => ({
          ...q, 
          id: `ai_q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique temp ID
          options: q.options.map(opt => ({...opt, id: `ai_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`}))
      }));
      setQuestions(prev => [...prev, ...newAiQuestions]); 
      setAiTopic(''); 
    } catch (err) { setAiError(err instanceof Error ? err.message : "AI question generation failed."); console.error("AI Generation Error:", err); } 
    finally { setIsGeneratingWithAI(false); }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setSuccessMessage('');
    if (!title.trim()) { setFormError('Quiz title is required.'); return; }
    if (questions.length === 0) { setFormError('At least one question is required for the quiz.'); return; }
    if (!quizId || !courseId || !user) { setFormError('Quiz, Course or User information is missing.'); return; }
    
    setFormSubmitting(true);
    try {
      const quizUpdateData: Partial<Omit<Quiz, 'id' | 'courseId'>> = { 
          title: title.trim(), 
          questions: questions.map(q => ({ // Ensure correct structure for API
              id: q.id.startsWith('temp_') || q.id.startsWith('ai_q_') ? undefined : q.id, // Send undefined for new/temp IDs
              text: q.text,
              type: q.type,
              options: q.options.map(opt => ({
                  id: opt.id.startsWith('temp_opt_') || opt.id.startsWith('ai_opt_') ? undefined : opt.id, // Send undefined for new/temp IDs
                  text: opt.text,
                  isCorrect: opt.isCorrect
              }))
          }))
      };

      const updatedQuiz = await apiService.updateQuiz(quizId, quizUpdateData);
      if (updatedQuiz) {
        setOriginalQuiz(updatedQuiz); // Update local original state
        setTitle(updatedQuiz.title);
        // FIX: Ensure questions and options have originalId after update for consistency
        setQuestions(updatedQuiz.questions.map(q => ({
            ...q, 
            options: q.options.map(opt => ({...opt, originalId: opt.id })) 
        })));
        setSuccessMessage(`Quiz "${updatedQuiz.title}" updated successfully!`);
        resetQuestionForm(); // Clear form after successful save
      } else {
        setFormError("Failed to update quiz. Response was null.");
      }
    } catch (err) { 
        console.error("Update Quiz Error:", err); 
        setFormError(err instanceof Error ? err.message : 'Failed to update quiz. Please try again.'); 
    } finally { 
        setFormSubmitting(false); 
    }
  };

  if (pageLoading) {
    return <div className="container mx-auto px-4 py-8 text-center"><LoadingSpinner /><p className="text-gray-600 mt-2">Loading quiz for editing...</p></div>;
  }
  
  if ((formError && !originalQuiz && !pageLoading) || (!originalQuiz && !pageLoading)) { // Major loading error or no quiz
      return (
        <div className="container mx-auto px-4 py-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-xl text-red-600">{formError || "Quiz not found or access denied."}</p>
            <Link to={courseId ? ROUTES.COURSE_DETAIL.replace(':courseId', courseId) : ROUTES.INSTRUCTOR_DASHBOARD}> 
              <Button variant="primary" className="mt-6">Back to {courseId ? "Course" : "Dashboard"}</Button> 
            </Link>
        </div> );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-0">
            Edit Quiz for <Link to={ROUTES.COURSE_DETAIL.replace(':courseId', courseId!)} className="text-blue-600 hover:underline">{course?.title || "Course"}</Link>
        </h1>
        <Button variant="outline" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId!))}>
            <ArrowUturnLeftIcon className="w-5 h-5 mr-2"/> Back to Course
        </Button>
      </div>
      
      <form onSubmit={handleSaveChanges} className="bg-white p-4 sm:p-8 rounded-xl shadow-2xl space-y-8 transition-colors duration-300 ease-in-out">
        <Input label="Quiz Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Chapter 1 Review" />

        {/* List of Existing/Added Questions */}
        {questions.length > 0 && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Current Quiz Questions ({questions.length}):</h3>
            <ul className="space-y-3">
              {questions.map((q, index) => (
                <li key={q.id} className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-800 text-sm flex-1 pr-2">{index + 1}. {q.text}</p>
                    <div className="flex space-x-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleEditQuestionFromList(q.id)} aria-label="Edit question" className="text-xs">Edit</Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveQuestionFromList(q.id)} aria-label="Remove question"><TrashIcon className="w-4 h-4"/></Button>
                    </div>
                  </div>
                  <ul className="list-disc list-inside ml-4 mt-1 text-xs text-gray-600">
                    {q.options.map(opt => ( <li key={opt.id} className={opt.isCorrect ? 'text-green-600 font-semibold' : ''}> {opt.text} {opt.isCorrect && <CheckCircleIcon className="w-3 h-3 inline ml-1 text-green-500" />}</li> ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Form for Adding New or Editing Existing Question */}
        <div id="edit-question-form" className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">{editingQuestionId ? "Edit Question" : "Add New Question"}</h2>
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                <Input label="Question Text" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} placeholder="Enter the question here" />
                <label className="block text-sm font-medium text-gray-700">Options (Mark correct answer)</label>
                {currentOptions.map((opt, index) => (
                    <div key={`current_opt_${index}`} className="flex items-center space-x-2">
                        <Input type="text" placeholder={`Option ${index + 1}`} value={opt.text || ''} onChange={(e) => handleOptionTextChange(index, e.target.value)} className="flex-grow" />
                        <input type="radio" id={`correct_opt_edit_${index}`} name="correctOptionEdit" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 bg-white" />
                         <label htmlFor={`correct_opt_edit_${index}`} className="text-sm text-gray-600 select-none">Correct</label>
                        {currentOptions.length > 2 && <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveOptionField(index)} aria-label="Remove option"><TrashIcon className="w-4 h-4" /></Button>}
                    </div>
                ))}
                <div className="flex flex-wrap gap-2 items-center">
                    {currentOptions.length < 4 && <Button type="button" variant="secondary" size="sm" onClick={handleAddOptionField} className="flex items-center text-xs"><PlusIcon className="w-4 h-4 mr-1"/>Add Option Field</Button>}
                    <Button type="button" variant="primary" onClick={handleSaveQuestion} className="flex items-center"><PlusIcon className="w-5 h-5 mr-1"/> {editingQuestionId ? "Update Question in List" : "Add Question to List"}</Button>
                    {editingQuestionId && <Button type="button" variant="outline" size="sm" onClick={resetQuestionForm} className="text-xs">Cancel Edit</Button>}
                </div>
            </div>
        </div>

        {/* AI Question Generation */}
        {geminiReady && (
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-1">Generate Additional Questions with AI ✨</h2>
            <p className="text-xs text-gray-500 mb-3">Powered by Gemini. Adds to the list above.</p>
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 space-y-3">
              <Input label="Topic for AI Questions" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g., Key Concepts of Photosynthesis" />
              <Button type="button" onClick={handleGenerateWithAI} disabled={isGeneratingWithAI || !aiTopic.trim()} variant="secondary" className="flex items-center">
                {isGeneratingWithAI ? <LoadingSpinner /> : <SparklesIcon className="w-5 h-5 mr-2"/>} Generate 3 Questions
              </Button>
              {aiError && <p className="text-red-500 text-sm mt-2">{aiError}</p>}
            </div>
          </div>
        )}
        {!geminiReady && (
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-md text-sm text-yellow-700">
                <ExclamationTriangleIcon className="w-5 h-5 inline mr-2 text-yellow-600" />
                AI question generation unavailable. Check API key configuration.
            </div>
        )}

        {formError && <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">{formError}</p>}
        {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-md">{successMessage}</p>}
        
        <div className="border-t border-gray-200 pt-6">
            <Button type="submit" variant="success" className="w-full text-lg py-3" disabled={formSubmitting || questions.length === 0}>
            {formSubmitting ? <LoadingSpinner /> : <><ArrowPathIcon className="w-5 h-5 mr-2 inline"/> Save All Changes to Quiz</>}
            </Button>
        </div>
      </form>
    </div>
  );
};

export default EditQuizPage;