
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeneratedQuizQuestion, QuizQuestion, QuizQuestionOption } from '../types';

// Attempt to get API_KEY from window.process.env if it exists (e.g., for local demo/dev)
// This is NOT recommended for production. API keys should be on a backend.
const API_KEY_PLACEHOLDER = "YOUR_GEMINI_API_KEY"; // Common placeholder
let apiKeyFromEnv: string | undefined = undefined;

if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env && (window as any).process.env.API_KEY) {
  apiKeyFromEnv = (window as any).process.env.API_KEY;
}

let ai: GoogleGenAI | null = null;
let geminiInitializationError: string | null = null;

if (apiKeyFromEnv && apiKeyFromEnv !== API_KEY_PLACEHOLDER && apiKeyFromEnv.trim() !== "" && apiKeyFromEnv.length > 10) { // Basic sanity check
  try {
    ai = new GoogleGenAI({ apiKey: apiKeyFromEnv });
    console.info("Gemini AI Service: Initialized with client-side API key for demo/dev purposes.");
    console.warn("Gemini AI Service: IMPORTANT - Using a client-side API key is insecure for production. Protect your API key by using a backend proxy.");
  } catch (error) {
    console.error("Gemini AI Service: Failed to initialize GoogleGenAI with client-side key:", error);
    geminiInitializationError = error instanceof Error ? error.message : "Unknown initialization error.";
    ai = null;
  }
} else {
  let warningMessage = "Gemini AI Service: AI features will be disabled or limited. ";
  if (!apiKeyFromEnv) {
    warningMessage += "API key not found (window.process.env.API_KEY is undefined or was removed from index.html).";
  } else if (apiKeyFromEnv === API_KEY_PLACEHOLDER || apiKeyFromEnv.trim() === "" || apiKeyFromEnv.length <=10) {
    warningMessage += "API key is a placeholder, empty, or too short.";
  }
  warningMessage += " For full functionality in development, provide a valid key in index.html. For production, always use a backend proxy.";
  console.warn(warningMessage);
  geminiInitializationError = warningMessage; // Store the warning as an error if no init
  ai = null;
}

export const generateQuizQuestionsWithGemini = async (topic: string, numberOfQuestions: number = 3): Promise<QuizQuestion[]> => {
  if (!ai) {
    const defaultError = "Gemini API client is not initialized.";
    throw new Error(geminiInitializationError || defaultError + " Ensure the API_KEY is correctly configured (ideally via a backend proxy for production).");
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
        throw new Error("Invalid or unauthorized Gemini API Key. Please check your configuration. For production, use a backend proxy.");
    }
    throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const isGeminiAvailable = (): boolean => {
  return ai !== null;
};