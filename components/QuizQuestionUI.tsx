
import React from 'react';
import { QuizQuestion, QuizQuestionOption } from '../types';

const lightOptionColors = [
  'bg-red-500 hover:bg-red-600',    
  'bg-blue-500 hover:bg-blue-600',   
  'bg-yellow-400 hover:bg-yellow-500', 
  'bg-green-500 hover:bg-green-600', 
];

const darkOptionColors = [ // Will not apply if 'dark' class removed from html
  'dark:bg-red-600 dark:hover:bg-red-700',
  'dark:bg-blue-600 dark:hover:bg-blue-700',
  'dark:bg-yellow-500 dark:hover:bg-yellow-600', 
  'dark:bg-green-600 dark:hover:bg-green-700',
];

const Shapes: React.FC<{ index: number, className?: string }>[] = [
  ({className}) => <svg viewBox="0 0 100 100" className={`w-6 h-6 mr-2 ${className}`}><polygon points="50,10 90,90 10,90" fill="currentColor"/></svg>, 
  ({className}) => <svg viewBox="0 0 100 100" className={`w-6 h-6 mr-2 ${className}`}><rect x="10" y="10" width="80" height="80" transform="rotate(45 50 50)" fill="currentColor"/></svg>, 
  ({className}) => <svg viewBox="0 0 100 100" className={`w-6 h-6 mr-2 ${className}`}><circle cx="50" cy="50" r="40" fill="currentColor"/></svg>, 
  ({className}) => <svg viewBox="0 0 100 100" className={`w-6 h-6 mr-2 ${className}`}><rect x="10" y="10" width="80" height="80" fill="currentColor"/></svg>,
];

interface QuizQuestionUIProps {
  question: QuizQuestion;
  onAnswerSelect: (optionId: string) => void;
  selectedOptionId?: string;
  isAnswered?: boolean;
  isCorrect?: boolean;
  liveAnswerStats?: { [optionId: string]: { count: number, nicknames: string[] } }; // For hosts
}

const QuizQuestionUI: React.FC<QuizQuestionUIProps> = ({ question, onAnswerSelect, selectedOptionId, isAnswered, isCorrect, liveAnswerStats }) => {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 bg-gray-100 text-gray-900 rounded-lg shadow-2xl transition-colors duration-300 ease-in-out">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">{question.text}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {question.options.map((option, index) => {
          const ShapeComponent = Shapes[index % Shapes.length];
          let baseButtonClass = `relative text-white font-bold py-4 sm:py-6 px-3 sm:px-4 rounded-lg text-lg sm:text-xl flex items-center justify-center transition-all duration-200 ease-in-out transform focus:outline-none focus:ring-4 focus:ring-opacity-50`;
          
          let colorClass = `${lightOptionColors[index % lightOptionColors.length]} ${darkOptionColors[index % darkOptionColors.length]}`;
          let ringFocusClass = `focus:ring-gray-400`; 

          if (isAnswered) {
            if (option.isCorrect) {
              colorClass = 'bg-green-600'; 
              baseButtonClass += ' scale-105 ring-4 ring-white'; 
              ringFocusClass = ''; 
            } else if (option.id === selectedOptionId && !option.isCorrect) {
              colorClass = 'bg-red-700'; 
              baseButtonClass += ' opacity-70';
              ringFocusClass = `focus:ring-red-400`;
            } else {
              baseButtonClass += ' opacity-50 cursor-not-allowed';
            }
          } else {
             baseButtonClass += ` hover:scale-105`; 
          }

          const answerCount = liveAnswerStats && liveAnswerStats[option.id] ? liveAnswerStats[option.id].count : 0;

          return (
            <button
              key={option.id}
              onClick={() => !isAnswered && onAnswerSelect(option.id)}
              disabled={isAnswered}
              className={`${baseButtonClass} ${colorClass} ${ringFocusClass}`}
              aria-label={`Option ${index + 1}: ${option.text}`}
            >
              <ShapeComponent index={index} className="text-white opacity-80" />
              <span className="truncate flex-1 text-center">{option.text}</span>
              {liveAnswerStats && (
                <span className={`absolute right-2 bottom-1 text-xs px-1.5 py-0.5 rounded-full bg-black bg-opacity-30 text-white font-semibold ${answerCount > 0 ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                  {answerCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {isAnswered && (
        <div className="mt-6 sm:mt-8 text-center">
          {isCorrect ? (
            <p className="text-3xl font-bold text-green-500">Correct!</p>
          ) : (
            <p className="text-3xl font-bold text-red-600">Incorrect!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizQuestionUI;