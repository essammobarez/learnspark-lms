
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeneratedQuizQuestion, QuizQuestion, QuizQuestionOption } from '../types';

// Ensure process.env.API_KEY is accessed correctly as per instructions
// The index.html includes a script to polyfill process.env for this demo
const API_KEY = typeof process !== 'undefined' && process.env && process.env.API_KEY ? process.env.API_KEY : undefined;

let ai: GoogleGenAI | null = null;
if (API_KEY && API_KEY !== "YOUR_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    ai = null;
  }
} else {
  console.warn("Gemini API key is not configured or is a placeholder. AI features will be disabled.");
}

export const generateQuizQuestionsWithGemini = async (topic: string, numberOfQuestions: number = 3): Promise<QuizQuestion[]> => {
  if (!ai) {
    throw new Error("Gemini API client is not initialized. Please configure API_KEY.");
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
        // Omit thinkingConfig for higher quality generation, as per guidelines for non-low-latency tasks
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
    if (error instanceof Error && error.message.includes("API key not valid")) {
        throw new Error("Invalid Gemini API Key. Please check your configuration.");
    }
    throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const isGeminiAvailable = (): boolean => {
  return ai !== null;
};
