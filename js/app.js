/**
 * Module E VocabMaster - Main Application Controller
 * Coordinates views, modals, quiz flow, word bank browser, and paper quiz generation.
 */

(function () {
  'use strict';

  class VocabApp {
    constructor() {
      this.currentView = 'dashboard';
      this.activeQuizState = null;
    }

    init() {
      this.bindNavigation();
      this.bindQuizSetup();
      this.bindQuizRunner();
      this.bindWordBank();
      this.bindModals();
      this.bindActions();

      const isStudentPortal = !document.getElementById('view-dashboard');

      if (isStudentPortal) {
        this.populateQuizLessons();
        this.showQuizSetup();
        const urlParams = new URLSearchParams(window.location.search);
        const quizParam = urlParams.get('quiz') || urlParams.get('lesson');
        if (quizParam) {
          const select = document.getElementById('quiz-select-lesson');
          if (select) select.value = quizParam;
        }
      } else {
        // Check URL parameters (e.g. ?quiz=lesson-1 or ?view=quiz)
        const urlParams = new URLSearchParams(window.location.search);
        const quizParam = urlParams.get('quiz');
        const viewParam = urlParams.get('view');

        if (quizParam || viewParam === 'quiz') {
          this.switchView('quiz');
          if (quizParam) {
            const select = document.getElementById('quiz-select-lesson');
            if (select) select.value = quizParam;
          }
        } else {
          this.switchView('dashboard');
        }

        window.VocabDashboard.renderDashboard();
      }
    }

    // --- Navigation ---

    bindNavigation() {
      const navLinks = document.querySelectorAll('.nav-tab');
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetView = link.getAttribute('data-view');
          if (targetView) {
            this.switchView(targetView);
          }
        });
      });
    }

    switchView(viewName) {
      this.currentView = viewName;

      // Update nav tabs
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-view') === viewName);
      });

      // Update view panels
      document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `view-${viewName}`);
      });

      // View-specific initialization
      if (viewName === 'dashboard') {
        window.VocabDashboard.renderDashboard();
      } else if (viewName === 'quiz') {
        this.populateQuizLessons();
        this.showQuizSetup();
      } else if (viewName === 'wordbank') {
        this.renderWordBank();
      }
    }

    // --- Quiz Setup ---

    bindQuizSetup() {
      const form = document.getElementById('form-start-quiz');
      if (!form) return;

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentName = (document.getElementById('input-student-name').value || '').trim();
        const studentClass = (document.getElementById('input-student-class').value || '').trim();
        const lessonId = document.getElementById('quiz-select-lesson').value;
        const qType = document.getElementById('quiz-question-type').value;

        if (!studentName) {
          alert('אנא הזן/י שם תלמיד/ה.');
          document.getElementById('input-student-name').focus();
          return;
        }

        this.startQuizSession({
          studentName,
          studentClass,
          lessonId,
          questionType: qType
        });
      });

      // Random 10 words button
      const btnRandom = document.getElementById('btn-random-quiz');
      if (btnRandom) {
        btnRandom.addEventListener('click', () => {
          const studentName = (document.getElementById('input-student-name').value || '').trim();
          const studentClass = (document.getElementById('input-student-class').value || '').trim();
          const qType = document.getElementById('quiz-question-type').value;

          if (!studentName) {
            alert('אנא הזן/י שם תלמיד/ה תחילה.');
            document.getElementById('input-student-name').focus();
            return;
          }

          const allWords = window.VocabDB.getAllWords();
          const random10 = window.VocabQuizEngine.shuffleArray(allWords).slice(0, 10);

          this.startQuizSessionWithWords(random10, {
            studentName,
            studentClass,
            quizId: 'random_' + Date.now(),
            quizTitle: 'בוחן 10 מילים אקראיות (Random Module E Words)',
            questionType: qType
          });
        });
      }
    }

    populateQuizLessons() {
      const select = document.getElementById('quiz-select-lesson');
      if (!select) return;

      const lessons = window.VocabDB.getAllLessons();
      const currentVal = select.value;

      select.innerHTML = '';
      lessons.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = `${l.title} (${l.sampleWords.slice(0, 35)}...)`;
        select.appendChild(opt);
      });

      if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
      }
    }

    startQuizSession(params) {
      const lessons = window.VocabDB.getAllLessons();
      const wordsPool = window.VocabDB.getAllWords();
      const lesson = lessons.find(l => l.id === params.lessonId) || lessons[0];

      if (!lesson) {
        alert('לא נמצא שאלון מתאים.');
        return;
      }

      const targetWords = lesson.wordIds
        .map(id => wordsPool.find(w => w.id === id))
        .filter(Boolean);

      if (targetWords.length === 0) {
        alert('השאלון אינו מכיל מילים.');
        return;
      }

      this.startQuizSessionWithWords(targetWords, {
        studentName: params.studentName,
        studentClass: params.studentClass,
        quizId: lesson.id,
        quizTitle: lesson.title,
        questionType: params.questionType
      });
    }

    startQuizSessionWithWords(words, meta) {
      document.getElementById('quiz-setup-card').style.display = 'none';
      document.getElementById('quiz-running-card').style.display = 'block';
      document.getElementById('quiz-results-card').style.display = 'none';

      window.VocabQuizEngine.startQuiz({
        words: words,
        studentName: meta.studentName,
        studentClass: meta.studentClass,
        quizId: meta.quizId,
        quizTitle: meta.quizTitle,
        questionType: meta.questionType || 'mixed',
        timerSeconds: 0,
        onQuestionChange: (q, state) => this.renderQuestionUI(q, state),
        onAnswerSubmitted: (record, state) => this.renderAnswerFeedback(record, state),
        onQuizFinished: (finalResult) => this.renderResultsUI(finalResult)
      });
    }

    showQuizSetup() {
      document.getElementById('quiz-setup-card').style.display = 'block';
      document.getElementById('quiz-running-card').style.display = 'none';
      document.getElementById('quiz-results-card').style.display = 'none';
    }

    // --- Quiz Runner UI ---

    bindQuizRunner() {
      const btnNext = document.getElementById('btn-next-question');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          document.getElementById('question-feedback-box').style.display = 'none';
          btnNext.style.display = 'none';
          window.VocabQuizEngine.nextQuestion();
        });
      }
    }

    renderQuestionUI(q, state) {
      const qNumEl = document.getElementById('q-current-num');
      const qTotalEl = document.getElementById('q-total-num');
      const qPromptEl = document.getElementById('q-prompt-text');
      const qSubPromptEl = document.getElementById('q-subprompt-text');
      const qOptionsContainer = document.getElementById('q-options-container');
      const feedbackBox = document.getElementById('question-feedback-box');
      const btnNext = document.getElementById('btn-next-question');
      const progressBar = document.getElementById('quiz-progress-bar');
      const audioBtn = document.getElementById('btn-speak-question');

      if (qNumEl) qNumEl.textContent = state.currentIndex + 1;
      if (qTotalEl) qTotalEl.textContent = state.totalQuestions;
      if (progressBar) progressBar.style.width = `${state.progress}%`;

      if (feedbackBox) feedbackBox.style.display = 'none';
      if (btnNext) btnNext.style.display = 'none';

      // Prompt and Audio button
      if (qPromptEl) qPromptEl.textContent = q.prompt;
      if (qSubPromptEl) qSubPromptEl.textContent = q.subPrompt;

      if (audioBtn) {
        audioBtn.onclick = () => window.VocabQuizEngine.speakWord(q.targetWord.word);
        // Automatically speak prompt word if it's an English word prompt
        if (q.type === 'en_to_he') {
          setTimeout(() => window.VocabQuizEngine.speakWord(q.targetWord.word), 300);
        }
      }

      // Render Options
      if (qOptionsContainer) {
        qOptionsContainer.innerHTML = '';
        const letters = ['א', 'ב', 'ג', 'ד'];

        q.options.forEach((optText, idx) => {
          const btn = document.createElement('button');
          btn.className = 'quiz-opt-btn';
          btn.setAttribute('type', 'button');
          btn.innerHTML = `
            <span class="opt-letter">${letters[idx] || (idx + 1)}</span>
            <span class="opt-text">${this.escapeHtml(optText)}</span>
          `;

          btn.addEventListener('click', () => {
            // Disable all option buttons
            const allBtns = qOptionsContainer.querySelectorAll('.quiz-opt-btn');
            allBtns.forEach(b => b.disabled = true);

            window.VocabQuizEngine.submitAnswer(optText);
          });

          qOptionsContainer.appendChild(btn);
        });
      }
    }

    renderAnswerFeedback(record, state) {
      const feedbackBox = document.getElementById('question-feedback-box');
      const btnNext = document.getElementById('btn-next-question');
      const optionsContainer = document.getElementById('q-options-container');

      // Highlight options
      if (optionsContainer) {
        const buttons = optionsContainer.querySelectorAll('.quiz-opt-btn');
        buttons.forEach(btn => {
          const text = btn.querySelector('.opt-text').textContent;
          if (text === record.correctAnswer) {
            btn.classList.add('correct');
          } else if (text === record.userAnswer && !record.isCorrect) {
            btn.classList.add('incorrect');
          }
        });
      }

      if (feedbackBox) {
        feedbackBox.style.display = 'block';
        feedbackBox.className = 'feedback-box ' + (record.isCorrect ? 'fb-correct' : 'fb-missed');

        const icon = record.isCorrect ? '🎉 תשובה נכונה!' : '❌ תשובה לא נכונה';
        feedbackBox.innerHTML = `
          <div class="fb-header">
            <strong>${icon}</strong>
            <button class="btn-speak-sm" onclick="VocabQuizEngine.speakWord('${this.escapeHtml(record.word)}')">🔊 שמע שוב</button>
          </div>
          <div class="fb-content">
            <p><strong>${this.escapeHtml(record.word)}</strong> = <span>${this.escapeHtml(record.translation)}</span> ${record.pos ? `<em>[${record.pos}]</em>` : ''}</p>
            ${record.example ? `<p class="fb-sentence">משפט לדוגמה: "<em>${this.escapeHtml(record.example)}</em>"</p>` : ''}
            ${record.meaning ? `<p class="fb-meaning">הגדרה: ${this.escapeHtml(record.meaning)}</p>` : ''}
          </div>
        `;
      }

      if (btnNext) {
        btnNext.style.display = 'inline-flex';
        btnNext.textContent = (state.currentIndex + 1 >= state.totalQuestions) ? 'סיום הבוחן וצפייה בציון 🏁' : 'שאלה הבאה ⬅';
        btnNext.focus();
      }
    }

    renderResultsUI(finalResult) {
      document.getElementById('quiz-running-card').style.display = 'none';
      const resultsCard = document.getElementById('quiz-results-card');
      resultsCard.style.display = 'block';

      const gradeScoreEl = document.getElementById('res-grade-pct');
      const ratioScoreEl = document.getElementById('res-score-ratio');
      const studentNameEl = document.getElementById('res-student-name');
      const messageEl = document.getElementById('res-message-banner');
      const listContainer = document.getElementById('res-words-breakdown');
      const btnRetryMissed = document.getElementById('btn-retry-missed');

      if (gradeScoreEl) gradeScoreEl.textContent = `${finalResult.percentage}%`;
      if (ratioScoreEl) ratioScoreEl.textContent = `${finalResult.score} מתוך ${finalResult.total} נכונים`;
      if (studentNameEl) studentNameEl.textContent = `תלמיד/ה: ${finalResult.studentName} (${finalResult.studentClass || 'ללא כיתה'})`;

      // Assessment message
      if (messageEl) {
        if (finalResult.percentage >= 90) {
          messageEl.className = 'res-banner banner-excellent';
          messageEl.innerHTML = `🌟 <strong>מצוין!</strong> רמת שליטה גבוהה ביותר באוצר המילים של מודול E!`;
        } else if (finalResult.percentage >= 70) {
          messageEl.className = 'res-banner banner-good';
          messageEl.innerHTML = `👍 <strong>עבודה יפה!</strong> תוצאה טובה. כדאי לחזור על המילים שטעית בהן.`;
        } else {
          messageEl.className = 'res-banner banner-need-practice';
          messageEl.innerHTML = `📚 <strong>ממשיכים לתרגל!</strong> מומלץ לחזור על המילים למטה כדי לשלוט בהן לקראת הבגרות.`;
        }
      }

      // Words Breakdown
      const missedWords = finalResult.wordsTested.filter(w => !w.isCorrect);

      if (listContainer) {
        listContainer.innerHTML = finalResult.wordsTested.map((w, idx) => `
          <div class="res-word-row ${w.isCorrect ? 'row-correct' : 'row-missed'}">
            <div class="rwr-num">${idx + 1}</div>
            <div class="rwr-word">
              <strong>${this.escapeHtml(w.word)}</strong>
              <button class="btn-speak-sm" onclick="VocabQuizEngine.speakWord('${this.escapeHtml(w.word)}')">🔊</button>
              <span class="rwr-trans">${this.escapeHtml(w.translation)}</span>
            </div>
            <div class="rwr-answers">
              ${w.isCorrect
                ? `<span class="tag-correct">✓ נכון (${this.escapeHtml(w.userAnswer)})</span>`
                : `<span class="tag-missed">✗ טעות (ענית: "${this.escapeHtml(w.userAnswer)}")</span>
                   <span class="tag-expected">נכון: ${this.escapeHtml(w.correctAnswer)}</span>`
              }
            </div>
          </div>
        `).join('');
      }

      // Retry Missed Words button
      if (btnRetryMissed) {
        if (missedWords.length > 0) {
          btnRetryMissed.style.display = 'inline-flex';
          btnRetryMissed.textContent = `תרגל שוב רק את ${missedWords.length} המילים שטעית בהן 🔄`;
          btnRetryMissed.onclick = () => {
            const allWords = window.VocabDB.getAllWords();
            const missedObjects = missedWords
              .map(mw => allWords.find(w => w.id === mw.wordId))
              .filter(Boolean);

            this.startQuizSessionWithWords(missedObjects, {
              studentName: finalResult.studentName,
              studentClass: finalResult.studentClass,
              quizId: 'retry_' + Date.now(),
              quizTitle: `חזרה על מילים שגויות (${finalResult.quizTitle})`,
              questionType: 'mixed'
            });
          };
        } else {
          btnRetryMissed.style.display = 'none';
        }
      }
    }

    // --- Word Bank View ---

    bindWordBank() {
      const searchInput = document.getElementById('wb-search');
      const listFilter = document.getElementById('wb-list-filter');

      if (searchInput) {
        searchInput.addEventListener('input', () => this.renderWordBank());
      }
      if (listFilter) {
        listFilter.addEventListener('change', () => this.renderWordBank());
      }
    }

    renderWordBank() {
      const container = document.getElementById('wb-cards-container');
      const countEl = document.getElementById('wb-count-display');
      if (!container) return;

      const words = window.VocabDB.getAllWords();
      const q = (document.getElementById('wb-search')?.value || '').trim().toLowerCase();
      const listFilter = document.getElementById('wb-list-filter')?.value || 'all';

      let filtered = words;

      if (listFilter !== 'all') {
        filtered = filtered.filter(w => w.list === listFilter);
      }

      if (q) {
        filtered = filtered.filter(w =>
          (w.word && w.word.toLowerCase().includes(q)) ||
          (w.translation && w.translation.includes(q)) ||
          (w.meaning && w.meaning.toLowerCase().includes(q)) ||
          (w.example && w.example.toLowerCase().includes(q))
        );
      }

      if (countEl) {
        countEl.textContent = `נמצאו ${filtered.length} מילים מתוך ${words.length}`;
      }

      // Render first 100 for fast responsiveness
      const displayWords = filtered.slice(0, 100);

      container.innerHTML = displayWords.map(w => `
        <div class="wb-card">
          <div class="wbc-header">
            <span class="wbc-word">${this.escapeHtml(w.word)}</span>
            <button class="btn-speak-sm" onclick="VocabQuizEngine.speakWord('${this.escapeHtml(w.word)}')">🔊</button>
            <span class="wbc-list-badge">${this.escapeHtml(w.list || 'Module E')}</span>
          </div>
          <div class="wbc-translation">
            <span class="wbc-trans-text">${this.escapeHtml(w.translation || '—')}</span>
            ${w.pos ? `<span class="wbc-pos">[${this.escapeHtml(w.pos)}]</span>` : ''}
          </div>
          ${w.example ? `<p class="wbc-example">"${this.escapeHtml(w.example)}"</p>` : ''}
          ${w.meaning ? `<p class="wbc-meaning">${this.escapeHtml(w.meaning)}</p>` : ''}
        </div>
      `).join('');

      if (filtered.length > 100) {
        container.innerHTML += `
          <div class="wb-more-notice">
            <p>מוצגות 100 תוצאות ראשונות מתוך ${filtered.length}. השתמש/י בשדה החיפוש לצמצום.</p>
          </div>
        `;
      }
    }

    // --- Printable Quiz Generator ---

    generatePrintableQuiz(lessonId) {
      const lessons = window.VocabDB.getAllLessons();
      const words = window.VocabDB.getAllWords();
      const lesson = lessons.find(l => l.id === lessonId) || lessons[0];

      if (!lesson) return;

      const targetWords = lesson.wordIds
        .map(id => words.find(w => w.id === id))
        .filter(Boolean);

      const modal = document.getElementById('modal-printable-quiz');
      const sheet = document.getElementById('printable-quiz-sheet');
      if (!modal || !sheet) return;

      // Generate 4 multiple-choice options for each question
      const questionsData = window.VocabQuizEngine.generateQuestions(targetWords, words, 'en_to_he');

      sheet.innerHTML = `
        <div class="print-page">
          <div class="print-header">
            <div class="ph-school">Module E Vocabulary Warm-Up Quiz</div>
            <div class="ph-title">${this.escapeHtml(lesson.title)}</div>
            <div class="ph-student-info">
              <span><strong>Student Name:</strong> ______________________</span>
              <span><strong>Class:</strong> _______</span>
              <span><strong>Date:</strong> _________</span>
              <span><strong>Score:</strong> ____ / 10</span>
            </div>
          </div>

          <div class="print-instructions">
            <strong>הוראות:</strong> סמן/י בעיגול את התרגום הנכון לכל מילה. / Circle the correct Hebrew translation for each word.
          </div>

          <div class="print-grid-questions">
            ${questionsData.map((q, idx) => `
              <div class="pq-item">
                <div class="pq-prompt">
                  <strong>${idx + 1}. ${this.escapeHtml(q.targetWord.word)}</strong>
                  ${q.targetWord.pos ? `<em>[${q.targetWord.pos}]</em>` : ''}
                </div>
                ${q.targetWord.example ? `<div class="pq-example">Context: "${this.escapeHtml(q.targetWord.example)}"</div>` : ''}
                <div class="pq-options">
                  ${q.options.map((opt, oIdx) => `
                    <span class="pq-opt">(${['a', 'b', 'c', 'd'][oIdx]}) ${this.escapeHtml(opt)}</span>
                  `).join(' &nbsp;&nbsp; ')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="print-footer">
            Module E Bagrut Preparation • 10-Word Weekly Warm-up
          </div>
        </div>

        <div class="print-page page-break-before">
          <div class="print-header">
            <div class="ph-school">Teacher Answer Key (דף תשובות למורה)</div>
            <div class="ph-title">${this.escapeHtml(lesson.title)}</div>
          </div>

          <table class="key-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Word</th>
                <th>Part of Speech</th>
                <th>Correct Translation</th>
                <th>English Meaning</th>
              </tr>
            </thead>
            <tbody>
              ${questionsData.map((q, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${this.escapeHtml(q.targetWord.word)}</strong></td>
                  <td>${this.escapeHtml(q.targetWord.pos || '—')}</td>
                  <td class="he-text"><strong>${this.escapeHtml(q.targetWord.translation)}</strong></td>
                  <td>${this.escapeHtml(q.targetWord.meaning || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      modal.classList.add('active');
    }

    // --- Action Handlers & Modals ---

    bindModals() {
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal || e.target.classList.contains('btn-close-modal')) {
            modal.classList.remove('active');
          }
        });
      });
    }

    bindActions() {
      // Export CSV
      const btnExport = document.getElementById('btn-export-csv');
      if (btnExport) {
        btnExport.addEventListener('click', () => window.VocabDashboard.downloadCSV());
      }

      // Seed Demo Data
      const btnSeed = document.getElementById('btn-seed-data');
      if (btnSeed) {
        btnSeed.addEventListener('click', () => {
          if (confirm('לטעון נתוני דוגמה של תלמידים להדגמת לוח הבקרה?')) {
            window.VocabDB.seedDemoData();
            window.VocabDashboard.renderDashboard();
            alert('נתוני הדוגמה נטענו בהצלחה!');
          }
        });
      }

      // Clear All Data
      const btnClear = document.getElementById('btn-clear-data');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          if (confirm('האם את/ה בטוח/ה שברצונך לאפס את כל תוצאות הבחנים?')) {
            window.VocabDB.clearAllResults();
            window.VocabDashboard.renderDashboard();
            alert('כל הנתונים אופסו.');
          }
        });
      }

      // Filter events
      const searchResults = document.getElementById('search-results');
      if (searchResults) {
        searchResults.addEventListener('input', (e) => {
          window.VocabDashboard.currentFilter.search = e.target.value;
          window.VocabDashboard.renderResultsTable();
        });
      }

      const filterLesson = document.getElementById('filter-lesson');
      if (filterLesson) {
        filterLesson.addEventListener('change', (e) => {
          window.VocabDashboard.currentFilter.lessonId = e.target.value;
          window.VocabDashboard.renderResultsTable();
        });
      }

      const filterScore = document.getElementById('filter-score');
      if (filterScore) {
        filterScore.addEventListener('change', (e) => {
          window.VocabDashboard.currentFilter.scoreRange = e.target.value;
          window.VocabDashboard.renderResultsTable();
        });
      }

      // Print Button in modal
      const btnPrint = document.getElementById('btn-print-sheet');
      if (btnPrint) {
        btnPrint.addEventListener('click', () => window.print());
      }

      // Quick launch printable quiz from toolbar
      const btnOpenPrintable = document.getElementById('btn-open-printable');
      if (btnOpenPrintable) {
        btnOpenPrintable.addEventListener('click', () => {
          const select = document.getElementById('filter-lesson');
          const lessonId = (select && select.value !== 'all') ? select.value : 'lesson-1';
          this.generatePrintableQuiz(lessonId);
        });
      }

      // Restart quiz from scorecard
      const btnRestart = document.getElementById('btn-restart-quiz');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => this.showQuizSetup());
      }

      const btnGoDashboard = document.getElementById('btn-back-dashboard');
      if (btnGoDashboard) {
        btnGoDashboard.addEventListener('click', () => this.switchView('dashboard'));
      }
    }

    escapeHtml(str) {
      return window.VocabDashboard.prototype.escapeHtml(str);
    }
  }

  window.VocabApp = new VocabApp();

  document.addEventListener('DOMContentLoaded', () => {
    window.VocabApp.init();
  });
})();
