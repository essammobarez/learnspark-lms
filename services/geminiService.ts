
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeneratedQuizQuestion, QuizQuestion, QuizQuestionOption } from '../types';

let ai: GoogleGenAI | null = null;
let geminiInitializationError: string | null = null;

// Vite uses import.meta.env for environment variables
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

try {
  if (!GEMINI_API_KEY) {
    geminiInitializationError = "Gemini AI Service: VITE_GEMINI_API_KEY is not defined. Please create a .env file in the project root and add it, or set it as an environment variable for deployment.";
    console.error(geminiInitializationError);
    ai = null;
  } else if (GEMINI_API_KEY.includes("YOUR_ACTUAL_GEMINI_API_KEY") || GEMINI_API_KEY.length < 10) { // Basic check for placeholder
    geminiInitializationError = "Gemini AI Service: VITE_GEMINI_API_KEY appears to be a placeholder. Please update it with your actual Gemini API key.";
    console.error(geminiInitializationError);
    ai = null;
  }
  else {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.info("Gemini AI Service: Initialized successfully.");
  }
} catch (error) {
  console.error("Gemini AI Service: Failed to initialize GoogleGenAI:", error);
  geminiInitializationError = error instanceof Error ? error.message : "Unknown initialization error.";
  ai = null;
}

export const generateQuizQuestionsWithGemini = async (topic: string, numberOfQuestions: number = 3): Promise<QuizQuestion[]> => {
  if (!ai) {
    const defaultError = "Gemini API client is not initialized.";
    throw new Error(geminiInitializationError || defaultError + " Ensure VITE_GEMINI_API_KEY is correctly configured.");
  }

  const prompt = `
    Generate ${numberOfQuestions} multiple-choice quiz questions about "${topic}".
    Each question should have 4 options, with only one correct answer.
    Format the output as a JSON array of objects. Each object in the array should represent a question and have the following structure:
    {
      "text": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0 
    }
    The 'correctAnswerIndex' should be the 0-based index of the correct option in the 'options' array.
    Ensure the response is ONLY the JSON array, without any markdown or other text.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17", 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const generatedData: GeneratedQuizQuestion[] = JSON.parse(jsonStr);

    if (!Array.isArray(generatedData) || generatedData.some(q => !q.text || !q.options || q.correctAnswerIndex === undefined)) {
        throw new Error("Invalid JSON structure received from AI.");
    }

    return generatedData.map((gq, index) => ({
      id: `ai_q_${Date.now()}_${index}`,
      text: gq.text,
      options: gq.options.map((optText, optIndex) => ({
        id: `ai_opt_${Date.now()}_${index}_${optIndex}`,
        text: optText,
        isCorrect: optIndex === gq.correctAnswerIndex,
      })),
      type: 'mcq',
    }));

  } catch (error) {
    console.error("Error generating quiz questions with Gemini:", error);
    if (error instanceof Error && (error.message.includes("API key not valid") || error.message.includes("permission denied"))) {
        throw new Error("Invalid or unauthorized Gemini API Key. Please check VITE_GEMINI_API_KEY in your .env file or environment configuration.");
    }
    throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const isGeminiAvailable = (): boolean => {
  return ai !== null && !geminiInitializationError; // Also check if there was an error during init
};
