

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeneratedQuizQuestion, QuizQuestion, QuizQuestionOption } from '../types';

let ai: GoogleGenAI | null = null;
let geminiInitializationError: string | null = null;

try {
  // FIX: Initialize GoogleGenAI directly with process.env.API_KEY as per guidelines.
  // Assume process.env.API_KEY is pre-configured and valid.
  if (!process.env.API_KEY) {
    // This case should ideally not happen based on problem constraints,
    // but good practice to have a fallback or clear error.
    geminiInitializationError = "Gemini AI Service: API_KEY is not defined in process.env.";
    console.error(geminiInitializationError);
    // ai remains null
  } else {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.info("Gemini AI Service: Initialized with API key from process.env.");
  }
} catch (error) {
  console.error("Gemini AI Service: Failed to initialize GoogleGenAI:", error);
  geminiInitializationError = error instanceof Error ? error.message : "Unknown initialization error.";
  ai = null; // Ensure ai is null on error
}

export const generateQuizQuestionsWithGemini = async (topic: string, numberOfQuestions: number = 3): Promise<QuizQuestion[]> => {
  if (!ai) {
    const defaultError = "Gemini API client is not initialized.";
    // FIX: Updated error message to be more concise given the new initialization logic.
    throw new Error(geminiInitializationError || defaultError + " Ensure the API_KEY is correctly configured in the environment.");
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
        // FIX: Updated error message for API key issues
        throw new Error("Invalid or unauthorized Gemini API Key. Please check the API_KEY in your environment configuration.");
    }
    throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const isGeminiAvailable = (): boolean => {
  return ai !== null;
};