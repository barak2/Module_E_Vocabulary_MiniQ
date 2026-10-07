/**
 * Module E VocabMaster - Quiz Engine
 * Generates dynamic 10-word quizzes, distractors, audio speech synthesis, and handles scoring.
 */

(function () {
  'use strict';

  class VocabQuizEngine {
    constructor() {
      this.currentQuiz = null;
      this.timerInterval = null;
    }

    /**
     * Start a new quiz session
     * @param {Object} config
     *   - words: Array of 10 word objects
     *   - studentName: String
     *   - studentClass: String
     *   - quizTitle: String
     *   - quizId: String
     *   - questionType: 'en_to_he' | 'he_to_en' | 'context' | 'mixed'
     *   - timerSeconds: Number (0 for untimed)
     *   - onQuestionChange: Function(question, state)
     *   - onAnswerSubmitted: Function(result, state)
     *   - onQuizFinished: Function(finalResult)
     */
    startQuiz(config) {
      if (!config.words || config.words.length === 0) {
        throw new Error('No words provided for quiz.');
      }

      const allWords = window.VocabDB.getAllWords();
      const questions = this.generateQuestions(config.words, allWords, config.questionType || 'mixed');

      this.currentQuiz = {
        id: config.quizId || 'quiz_' + Date.now(),
        title: config.quizTitle || 'Module E 10-Word Quiz',
        studentName: (config.studentName || 'Student').trim(),
        studentClass: (config.studentClass || '').trim(),
        words: config.words,
        questions: questions,
        currentIndex: 0,
        timerSeconds: config.timerSeconds || 0,
        timeRemaining: config.timerSeconds || 0,
        startTime: Date.now(),
        userAnswers: [],
        callbacks: {
          onQuestionChange: config.onQuestionChange,
          onAnswerSubmitted: config.onAnswerSubmitted,
          onQuizFinished: config.onQuizFinished
        }
      };

      this.loadCurrentQuestion();
      return this.currentQuiz;
    }

    generateQuestions(words, pool, preferredType) {
      // Clone and optionally shuffle
      const targetWords = [...words];

      return targetWords.map((wordObj, idx) => {
        let qType = preferredType;
        if (preferredType === 'mixed') {
          // If word has a good example sentence, context question is great!
          if (wordObj.example && wordObj.example.length > 15 && idx % 3 === 2) {
            qType = 'context';
          } else if (idx % 2 === 0) {
            qType = 'en_to_he';
          } else {
            qType = 'he_to_en';
          }
        }

        // If context question chosen but no example available, fallback to en_to_he
        if (qType === 'context' && (!wordObj.example || wordObj.example.length < 10)) {
          qType = 'en_to_he';
        }

        return this.buildSingleQuestion(wordObj, pool, qType, idx + 1);
      });
    }

    buildSingleQuestion(wordObj, pool, qType, questionNumber) {
      const question = {
        questionNumber: questionNumber,
        type: qType,
        targetWord: wordObj,
        prompt: '',
        subPrompt: '',
        correctAnswer: '',
        options: [],
        explanation: {
          word: wordObj.word,
          pos: wordObj.pos,
          translation: wordObj.translation,
          meaning: wordObj.meaning,
          example: wordObj.example
        }
      };

      if (qType === 'en_to_he') {
        // Prompt: English word -> Answer: Hebrew translation
        question.prompt = wordObj.word;
        question.subPrompt = wordObj.pos ? `[${wordObj.pos}]` : 'Choose the correct Hebrew meaning:';
        question.correctAnswer = wordObj.translation;

        // Distractors: other Hebrew translations
        const distractors = this.getDistractors(
          wordObj,
          pool,
          w => w.translation && w.translation !== wordObj.translation,
          w => w.translation,
          3
        );
        question.options = this.shuffleArray([wordObj.translation, ...distractors]);

      } else if (qType === 'he_to_en') {
        // Prompt: Hebrew translation -> Answer: English word
        question.prompt = wordObj.translation;
        question.subPrompt = 'בחר/י את המילה המתאימה באנגלית:';
        question.correctAnswer = wordObj.word;

        // Distractors: other English words
        const distractors = this.getDistractors(
          wordObj,
          pool,
          w => w.word && w.word.toLowerCase() !== wordObj.word.toLowerCase(),
          w => w.word,
          3
        );
        question.options = this.shuffleArray([wordObj.word, ...distractors]);

      } else if (qType === 'context') {
        // Fill-in-the-blank from example sentence
        const blankedSentence = this.createBlankSentence(wordObj.example, wordObj.word);
        question.prompt = blankedSentence;
        question.subPrompt = 'Complete the sentence with the correct Module E word:';
        question.correctAnswer = wordObj.word;

        // Distractors: other English words (preferably same POS)
        const distractors = this.getDistractors(
          wordObj,
          pool,
          w => w.word && w.word.toLowerCase() !== wordObj.word.toLowerCase(),
          w => w.word,
          3
        );
        question.options = this.shuffleArray([wordObj.word, ...distractors]);
      }

      return question;
    }

    createBlankSentence(example, word) {
      if (!example) return `_____ : ${word}`;
      // Clean word for regex (e.g. remove parentheses like "(all) on your own")
      const cleanWord = word.replace(/[()]/g, '').trim();
      const firstMainWord = cleanWord.split(/\s+/)[0];

      // Try replacing the full word phrase
      const regexFull = new RegExp('\\b' + cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      if (regexFull.test(example)) {
        return example.replace(regexFull, '_______');
      }

      // Try first word of phrasal verbs
      if (firstMainWord.length > 2) {
        const regexFirst = new RegExp('\\b' + firstMainWord + '\\b', 'gi');
        if (regexFirst.test(example)) {
          return example.replace(regexFirst, '_______');
        }
      }

      return `[Fill in: "${word}"] ${example}`;
    }

    getDistractors(targetWord, pool, filterFn, mapFn, count) {
      // Try to find pool candidates matching part of speech first
      let candidates = pool.filter(filterFn);

      if (targetWord.pos) {
        const samePos = candidates.filter(w => w.pos && w.pos.toLowerCase() === targetWord.pos.toLowerCase());
        if (samePos.length >= count) {
          candidates = samePos;
        }
      }

      const shuffled = this.shuffleArray(candidates);
      const uniqueDistractors = new Set();
      const result = [];

      for (const item of shuffled) {
        const val = mapFn(item);
        if (val && !uniqueDistractors.has(val)) {
          uniqueDistractors.add(val);
          result.push(val);
          if (result.length === count) break;
        }
      }

      // Fallback if not enough distractors
      const fallbackList = ['אחר / שונה', 'לבדוק', 'מידע חשוב', 'תוצאה חיובית', 'הסכם'];
      while (result.length < count) {
        result.push(fallbackList[result.length % fallbackList.length]);
      }

      return result;
    }

    shuffleArray(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    loadCurrentQuestion() {
      if (!this.currentQuiz) return;
      const q = this.currentQuiz.questions[this.currentQuiz.currentIndex];

      // Reset timer if active
      clearInterval(this.timerInterval);
      if (this.currentQuiz.timerSeconds > 0) {
        this.currentQuiz.timeRemaining = this.currentQuiz.timerSeconds;
        this.timerInterval = setInterval(() => {
          this.currentQuiz.timeRemaining--;
          if (this.currentQuiz.timeRemaining <= 0) {
            clearInterval(this.timerInterval);
            this.submitAnswer(null, true); // Time out
          }
        }, 1000);
      }

      if (this.currentQuiz.callbacks.onQuestionChange) {
        this.currentQuiz.callbacks.onQuestionChange(q, this.getQuizState());
      }
    }

    submitAnswer(selectedAnswer, isTimedOut = false) {
      if (!this.currentQuiz) return;
      clearInterval(this.timerInterval);

      const q = this.currentQuiz.questions[this.currentQuiz.currentIndex];
      const isCorrect = !isTimedOut && selectedAnswer === q.correctAnswer;

      const record = {
        questionIndex: this.currentQuiz.currentIndex,
        wordId: q.targetWord.id,
        word: q.targetWord.word,
        translation: q.targetWord.translation,
        pos: q.targetWord.pos,
        meaning: q.targetWord.meaning,
        example: q.targetWord.example,
        userAnswer: isTimedOut ? '(זמן עבר / לא נענה)' : (selectedAnswer || ''),
        correctAnswer: q.correctAnswer,
        isCorrect: isCorrect,
        isTimedOut: isTimedOut,
        questionType: q.type
      };

      this.currentQuiz.userAnswers.push(record);

      if (this.currentQuiz.callbacks.onAnswerSubmitted) {
        this.currentQuiz.callbacks.onAnswerSubmitted(record, this.getQuizState());
      }

      return record;
    }

    nextQuestion() {
      if (!this.currentQuiz) return;
      this.currentQuiz.currentIndex++;

      if (this.currentQuiz.currentIndex >= this.currentQuiz.questions.length) {
        this.finishQuiz();
      } else {
        this.loadCurrentQuestion();
      }
    }

    finishQuiz() {
      if (!this.currentQuiz) return;
      clearInterval(this.timerInterval);

      const correctCount = this.currentQuiz.userAnswers.filter(a => a.isCorrect).length;
      const totalCount = this.currentQuiz.questions.length;
      const percentage = Math.round((correctCount / totalCount) * 100);
      const timeSpentSec = Math.round((Date.now() - this.currentQuiz.startTime) / 1000);

      const finalResult = {
        studentName: this.currentQuiz.studentName,
        studentClass: this.currentQuiz.studentClass,
        quizId: this.currentQuiz.id,
        quizTitle: this.currentQuiz.title,
        timestamp: new Date().toISOString(),
        score: correctCount,
        total: totalCount,
        percentage: percentage,
        timeTakenSeconds: timeSpentSec,
        wordsTested: this.currentQuiz.userAnswers
      };

      // Automatically save to local database
      window.VocabDB.saveQuizResult(finalResult);

      if (this.currentQuiz.callbacks.onQuizFinished) {
        this.currentQuiz.callbacks.onQuizFinished(finalResult);
      }

      return finalResult;
    }

    getQuizState() {
      if (!this.currentQuiz) return null;
      return {
        currentIndex: this.currentQuiz.currentIndex,
        totalQuestions: this.currentQuiz.questions.length,
        progress: Math.round(((this.currentQuiz.currentIndex + 1) / this.currentQuiz.questions.length) * 100),
        timeRemaining: this.currentQuiz.timeRemaining,
        scoreSoFar: this.currentQuiz.userAnswers.filter(a => a.isCorrect).length
      };
    }

    /**
     * Pronounce English word using Web Speech API
     */
    speakWord(wordText) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel(); // Stop any pending speech

      const cleanWord = wordText.replace(/[()]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanWord);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // Slightly slower for clear high-school ESL comprehension
      window.speechSynthesis.speak(utterance);
    }
  }

  window.VocabQuizEngine = new VocabQuizEngine();
})();
