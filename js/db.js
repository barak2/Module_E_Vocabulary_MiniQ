/**
 * Module E VocabMaster - Database & Local Storage Layer
 * Manages quiz results, student profiles, trouble words analytics, and data export.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    RESULTS: 'module_e_quiz_results',
    CUSTOM_WORDS: 'module_e_custom_words',
    CUSTOM_LESSONS: 'module_e_custom_lessons',
    SETTINGS: 'module_e_settings'
  };

  const DEFAULT_SETTINGS = {
    timerSeconds: 0, // 0 = untimed
    questionType: 'mixed', // 'en_to_he', 'he_to_en', 'context', 'mixed'
    shuffleQuestions: true,
    speechEnabled: true
  };

  class VocabDB {
    constructor() {
      this.init();
    }

    init() {
      if (!localStorage.getItem(STORAGE_KEYS.RESULTS)) {
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CUSTOM_WORDS)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_WORDS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CUSTOM_LESSONS)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_LESSONS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      }
    }

    // --- Results Management ---

    getAllResults() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.RESULTS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error('Error reading results:', e);
        return [];
      }
    }

    saveQuizResult(result) {
      try {
        const results = this.getAllResults();
        // Generate ID and timestamp if not present
        if (!result.id) {
          result.id = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        }
        if (!result.timestamp) {
          result.timestamp = new Date().toISOString();
        }
        results.unshift(result); // newest first
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
        return result;
      } catch (e) {
        console.error('Error saving quiz result:', e);
        return null;
      }
    }

    deleteResult(resultId) {
      try {
        let results = this.getAllResults();
        results = results.filter(r => r.id !== resultId);
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
        return true;
      } catch (e) {
        console.error('Error deleting result:', e);
        return false;
      }
    }

    clearAllResults() {
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify([]));
      return true;
    }

    // --- Student Summaries ---

    getStudentSummaries() {
      const results = this.getAllResults();
      const studentMap = {};

      results.forEach(r => {
        const name = (r.studentName || 'Anonymous').trim();
        if (!studentMap[name]) {
          studentMap[name] = {
            name: name,
            studentClass: r.studentClass || '',
            totalQuizzes: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            scores: [],
            lastActive: r.timestamp,
            recentQuizzes: []
          };
        }
        const s = studentMap[name];
        s.totalQuizzes++;
        s.totalQuestions += (r.total || 10);
        s.totalCorrect += (r.score || 0);
        s.scores.push(r.percentage);
        if (new Date(r.timestamp) > new Date(s.lastActive)) {
          s.lastActive = r.timestamp;
        }
        if (s.recentQuizzes.length < 5) {
          s.recentQuizzes.push(r);
        }
      });

      return Object.values(studentMap).map(s => {
        const avg = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : 0;
        return {
          ...s,
          averageGrade: avg,
          accuracyRate: s.totalQuestions ? Math.round((s.totalCorrect / s.totalQuestions) * 100) : 0
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }

    // --- Class Trouble Words Analytics ---

    getTroubleWords() {
      const results = this.getAllResults();
      const wordStats = {};

      results.forEach(r => {
        if (!r.wordsTested || !Array.isArray(r.wordsTested)) return;
        r.wordsTested.forEach(item => {
          const key = (item.word || '').trim().toLowerCase();
          if (!key) return;

          if (!wordStats[key]) {
            wordStats[key] = {
              word: item.word,
              translation: item.translation || '',
              pos: item.pos || '',
              example: item.example || '',
              meaning: item.meaning || '',
              totalTested: 0,
              missedCount: 0,
              correctCount: 0,
              missedByStudents: new Set()
            };
          }

          const ws = wordStats[key];
          ws.totalTested++;
          if (item.isCorrect) {
            ws.correctCount++;
          } else {
            ws.missedCount++;
            if (r.studentName) {
              ws.missedByStudents.add(r.studentName.trim());
            }
          }
        });
      });

      return Object.values(wordStats)
        .map(ws => ({
          ...ws,
          missRate: Math.round((ws.missedCount / ws.totalTested) * 100),
          studentsCount: ws.missedByStudents.size,
          missedByStudentsList: Array.from(ws.missedByStudents)
        }))
        .filter(ws => ws.missedCount > 0)
        .sort((a, b) => {
          if (b.missedCount !== a.missedCount) {
            return b.missedCount - a.missedCount;
          }
          return b.missRate - a.missRate;
        });
    }

    // --- Word Bank Access & Custom Words ---

    getAllWords() {
      const defaultWords = (window.MODULE_E_WORDS && Array.isArray(window.MODULE_E_WORDS))
        ? window.MODULE_E_WORDS
        : [];
      let customWords = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_WORDS);
        if (raw) customWords = JSON.parse(raw);
      } catch (e) {
        console.error('Error reading custom words:', e);
      }
      return [...defaultWords, ...customWords];
    }

    getWordById(wordId) {
      return this.getAllWords().find(w => w.id === wordId) || null;
    }

    saveCustomWord(wordObj) {
      try {
        let customWords = [];
        const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_WORDS);
        if (raw) customWords = JSON.parse(raw);

        if (!wordObj.id) {
          wordObj.id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        }
        wordObj.list = wordObj.list || 'Custom Words';
        wordObj.isCustom = true;

        const existingIdx = customWords.findIndex(w => w.id === wordObj.id);
        if (existingIdx >= 0) {
          customWords[existingIdx] = wordObj;
        } else {
          customWords.push(wordObj);
        }

        localStorage.setItem(STORAGE_KEYS.CUSTOM_WORDS, JSON.stringify(customWords));
        return wordObj;
      } catch (e) {
        console.error('Error saving custom word:', e);
        return null;
      }
    }

    getAllLessons() {
      const defaultLessons = (window.MODULE_E_LESSONS && Array.isArray(window.MODULE_E_LESSONS))
        ? window.MODULE_E_LESSONS
        : [];
      let customLessons = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_LESSONS);
        if (raw) customLessons = JSON.parse(raw);
      } catch (e) {
        console.error('Error reading custom lessons:', e);
      }
      return [...defaultLessons, ...customLessons];
    }

    saveCustomLesson(lessonObj) {
      try {
        let customLessons = [];
        const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_LESSONS);
        if (raw) customLessons = JSON.parse(raw);

        if (!lessonObj.id) {
          lessonObj.id = 'custom_lesson_' + Date.now();
        }
        lessonObj.isCustom = true;

        const existingIdx = customLessons.findIndex(l => l.id === lessonObj.id);
        if (existingIdx >= 0) {
          customLessons[existingIdx] = lessonObj;
        } else {
          customLessons.push(lessonObj);
        }

        localStorage.setItem(STORAGE_KEYS.CUSTOM_LESSONS, JSON.stringify(customLessons));
        return lessonObj;
      } catch (e) {
        console.error('Error saving custom lesson:', e);
        return null;
      }
    }

    // --- Settings ---

    getSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
      } catch (e) {
        return { ...DEFAULT_SETTINGS };
      }
    }

    saveSettings(newSettings) {
      try {
        const current = this.getSettings();
        const updated = { ...current, ...newSettings };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
        return updated;
      } catch (e) {
        console.error('Error saving settings:', e);
        return null;
      }
    }

    // --- CSV & Export Utilities ---

    exportResultsCSV() {
      const results = this.getAllResults();
      if (!results.length) return null;

      // Header row
      const headers = [
        'Timestamp',
        'Student Name',
        'Student Class',
        'Quiz / Lesson Title',
        'Score',
        'Total',
        'Grade (%)',
        'Words Tested (Summary)',
        'Words Missed',
        'Words Correct'
      ];

      const rows = results.map(r => {
        const dateStr = new Date(r.timestamp).toLocaleString('he-IL');
        const missedWords = (r.wordsTested || [])
          .filter(w => !w.isCorrect)
          .map(w => w.word + (w.translation ? ` (${w.translation})` : ''))
          .join('; ');
        const correctWords = (r.wordsTested || [])
          .filter(w => w.isCorrect)
          .map(w => w.word)
          .join('; ');
        const allWords = (r.wordsTested || [])
          .map(w => w.word)
          .join(', ');

        return [
          dateStr,
          r.studentName || '',
          r.studentClass || '',
          r.quizTitle || '',
          r.score !== undefined ? r.score : '',
          r.total || 10,
          r.percentage !== undefined ? r.percentage : '',
          allWords,
          missedWords,
          correctWords
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      });

      // UTF-8 BOM so Excel opens Hebrew properly without broken characters
      const bom = '\uFEFF';
      return bom + [headers.join(','), ...rows].join('\r\n');
    }

    // Sample data loader for demonstration / testing
    seedDemoData() {
      const demoStudents = [
        { name: 'נועם כהן', class: 'י"א 4 יח"ל' },
        { name: 'מאיה לוי', class: 'י"א 4 יח"ל' },
        { name: 'דניאל אברהם', class: 'י"א 4 יח"ל' },
        { name: 'שירה מזרחי', class: 'י"א 5 יח"ל' },
        { name: 'איתי פרידמן', class: 'י"א 5 יח"ל' }
      ];

      const lessons = this.getAllLessons().slice(0, 3);
      if (!lessons.length) return;

      const words = this.getAllWords();
      const now = Date.now();

      demoStudents.forEach((student, sIdx) => {
        lessons.forEach((lesson, lIdx) => {
          const lessonWordObjs = lesson.wordIds
            .map(id => words.find(w => w.id === id))
            .filter(Boolean);

          const tested = lessonWordObjs.map((w, wIdx) => {
            // Give reasonable realistic answers
            const isCorrect = (sIdx + wIdx) % 4 !== 0;
            return {
              wordId: w.id,
              word: w.word,
              translation: w.translation,
              pos: w.pos,
              example: w.example,
              meaning: w.meaning,
              userAnswer: isCorrect ? w.translation : 'תשובה לא נכונה',
              correctAnswer: w.translation,
              isCorrect: isCorrect
            };
          });

          const correctCount = tested.filter(t => t.isCorrect).length;
          const totalCount = tested.length;
          const percentage = Math.round((correctCount / totalCount) * 100);

          const dateOffset = (sIdx * 2 + lIdx) * 86400000;
          this.saveQuizResult({
            id: 'demo_' + sIdx + '_' + lIdx,
            studentName: student.name,
            studentClass: student.class,
            quizId: lesson.id,
            quizTitle: lesson.title,
            timestamp: new Date(now - dateOffset).toISOString(),
            score: correctCount,
            total: totalCount,
            percentage: percentage,
            timeTakenSeconds: 110 + sIdx * 10,
            wordsTested: tested
          });
        });
      });
    }
  }

  window.VocabDB = new VocabDB();
})();
