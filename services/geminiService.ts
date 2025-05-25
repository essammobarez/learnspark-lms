
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeneratedQuizQuestion, QuizQuestion, QuizQuestionOption } from '../types';

// Attempt to get API_KEY from window.process.env if it exists (e.g., for local demo/dev)
// This is NOT recommended for production. API keys should be on a backend.
// FIX: Use process.env.API_KEY as per guidelines
const apiKeyFromEnv: string | undefined = process.env.API_KEY;


let ai: GoogleGenAI | null = null;
let geminiInitializationError: string | null = null;

// FIX: Corrected API key placeholder check and initialization based on guidelines
const API_KEY_PLACEHOLDER_GENERIC = "YOUR_GEMINI_API_KEY"; // A generic placeholder
if (apiKeyFromEnv && apiKeyFromEnv !== API_KEY_PLACEHOLDER_GENERIC && apiKeyFromEnv.trim() !== "" && apiKeyFromEnv.length > 10) { // Basic sanity check
  try {
    // FIX: Initialize with {apiKey: process.env.API_KEY}
    ai = new GoogleGenAI({ apiKey: apiKeyFromEnv });
    console.info("Gemini AI Service: Initialized.");
  } catch (error) {
    console.error("Gemini AI Service: Failed to initialize GoogleGenAI:", error);
    geminiInitializationError = error instanceof Error ? error.message : "Unknown initialization error.";
    ai = null;
  }
} else {
  let warningMessage = "Gemini AI Service: AI features will be disabled or limited. ";
  if (!apiKeyFromEnv) {
    warningMessage += "API_KEY environment variable is not set.";
  } else if (apiKeyFromEnv === API_KEY_PLACEHOLDER_GENERIC || apiKeyFromEnv.trim() === "" || apiKeyFromEnv.length <=10) {
    warningMessage += "API_KEY is a placeholder, empty, or too short.";
  }
  warningMessage += " For full functionality, ensure a valid API_KEY is available in process.env.API_KEY.";
  console.warn(warningMessage);
  geminiInitializationError = warningMessage; 
  ai = null;
}

export const generateQuizQuestionsWithGemini = async (topic: string, numberOfQuestions: number = 3): Promise<QuizQuestion[]> => {
  if (!ai) {
    const defaultError = "Gemini API client is not initialized.";
    throw new Error(geminiInitializationError || defaultError + " Ensure the API_KEY is correctly configured.");
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

    // FIX: Changed string ID to a temporary numeric ID and added orderIndex
    return generatedData.map((gq, index) => ({
      // FIX: Use temporary numeric ID (negative to distinguish from DB IDs)
      id: -(Date.now() + index), 
      text: gq.text,
      options: gq.options.map((optText, optIndex) => ({
        // FIX: Use temporary numeric ID for options
        id: -(Date.now() + index * 1000 + optIndex + 100), // Make distinct from question ID and other option IDs
        text: optText,
        isCorrect: optIndex === gq.correctAnswerIndex,
      })),
      type: 'mcq',
      // FIX: Add orderIndex as it's part of QuizQuestion type (optional)
      orderIndex: index,
    }));

  } catch (error) {
    console.error("Error generating quiz questions with Gemini:", error);
    if (error instanceof Error && (error.message.includes("API key not valid") || error.message.includes("permission denied"))) {
        throw new Error("Invalid or unauthorized Gemini API Key. Please check your configuration.");
    }
    throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const isGeminiAvailable = (): boolean => {
  return ai !== null;
};
