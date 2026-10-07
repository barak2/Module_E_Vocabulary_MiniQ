/**
 * Module E VocabMaster - Teacher Dashboard & Analytics
 * Handles gradebook rendering, trouble words identification, student rosters, and exports.
 */

(function () {
  'use strict';

  class VocabDashboard {
    constructor() {
      this.currentFilter = {
        search: '',
        lessonId: 'all',
        scoreRange: 'all'
      };
    }

    renderDashboard() {
      this.renderSummaryStats();
      this.renderTroubleWords();
      this.renderResultsTable();
      this.renderStudentRoster();
      this.populateFilterDropdowns();
    }

    renderSummaryStats() {
      const results = window.VocabDB.getAllResults();
      const students = window.VocabDB.getStudentSummaries();
      const troubleWords = window.VocabDB.getTroubleWords();

      const totalQuizzesEl = document.getElementById('stat-total-quizzes');
      const totalStudentsEl = document.getElementById('stat-total-students');
      const avgGradeEl = document.getElementById('stat-avg-grade');
      const troubleCountEl = document.getElementById('stat-trouble-words');

      if (totalQuizzesEl) totalQuizzesEl.textContent = results.length;
      if (totalStudentsEl) totalStudentsEl.textContent = students.length;

      if (avgGradeEl) {
        if (results.length === 0) {
          avgGradeEl.textContent = '—';
        } else {
          const sum = results.reduce((acc, r) => acc + (r.percentage || 0), 0);
          const avg = Math.round(sum / results.length);
          avgGradeEl.textContent = avg + '%';
        }
      }

      if (troubleCountEl) {
        troubleCountEl.textContent = troubleWords.length;
      }
    }

    populateFilterDropdowns() {
      const selectLesson = document.getElementById('filter-lesson');
      if (!selectLesson) return;

      const lessons = window.VocabDB.getAllLessons();
      const currentVal = selectLesson.value;

      selectLesson.innerHTML = '<option value="all">כל השיעורים והשאלונים (All Lessons)</option>';
      lessons.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.title;
        selectLesson.appendChild(opt);
      });

      if (currentVal) selectLesson.value = currentVal;
    }

    renderResultsTable() {
      const tbody = document.getElementById('results-tbody');
      if (!tbody) return;

      let results = window.VocabDB.getAllResults();

      // Apply Filters
      const q = (this.currentFilter.search || '').trim().toLowerCase();
      if (q) {
        results = results.filter(r =>
          (r.studentName && r.studentName.toLowerCase().includes(q)) ||
          (r.studentClass && r.studentClass.toLowerCase().includes(q)) ||
          (r.quizTitle && r.quizTitle.toLowerCase().includes(q)) ||
          (r.wordsTested && r.wordsTested.some(w => w.word && w.word.toLowerCase().includes(q)))
        );
      }

      if (this.currentFilter.lessonId && this.currentFilter.lessonId !== 'all') {
        results = results.filter(r => r.quizId === this.currentFilter.lessonId);
      }

      if (this.currentFilter.scoreRange && this.currentFilter.scoreRange !== 'all') {
        if (this.currentFilter.scoreRange === 'high') {
          results = results.filter(r => r.percentage >= 90);
        } else if (this.currentFilter.scoreRange === 'mid') {
          results = results.filter(r => r.percentage >= 70 && r.percentage < 90);
        } else if (this.currentFilter.scoreRange === 'low') {
          results = results.filter(r => r.percentage < 70);
        }
      }

      if (results.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <div class="empty-box">
                <span class="empty-icon">📝</span>
                <p>לא נמצאו ציונים שתואמים את הסינון הנוכחי.</p>
                <small>התלמידים יכולים לבצע בוחן דרך הלשונית "בצע בוחן" או לשתף איתם קישור.</small>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = results.map(r => {
        const dateObj = new Date(r.timestamp);
        const formattedDate = dateObj.toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = dateObj.toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit'
        });

        // Score badge class
        let badgeClass = 'badge-success';
        if (r.percentage < 70) badgeClass = 'badge-danger';
        else if (r.percentage < 90) badgeClass = 'badge-warning';

        // Words chips
        const wordsChips = (r.wordsTested || []).map(w => {
          const chipClass = w.isCorrect ? 'chip-correct' : 'chip-missed';
          const icon = w.isCorrect ? '✓' : '✗';
          return `<span class="word-chip ${chipClass}" title="${w.isCorrect ? 'נכון' : 'שגוי'}: ${w.word} (${w.translation || ''})">${icon} ${w.word}</span>`;
        }).join('');

        return `
          <tr data-result-id="${r.id}">
            <td class="col-date">
              <span class="date-main">${formattedDate}</span>
              <span class="date-sub">${formattedTime}</span>
            </td>
            <td class="col-student">
              <strong>${this.escapeHtml(r.studentName || 'אנונימי')}</strong>
              ${r.studentClass ? `<span class="class-tag">${this.escapeHtml(r.studentClass)}</span>` : ''}
            </td>
            <td class="col-quiz">
              <span class="quiz-title-cell">${this.escapeHtml(r.quizTitle || 'בוחן 10 מילים')}</span>
            </td>
            <td class="col-grade">
              <span class="grade-badge ${badgeClass}">${r.percentage}%</span>
              <span class="score-ratio">(${r.score}/${r.total || 10})</span>
            </td>
            <td class="col-words">
              <div class="words-container">
                ${wordsChips}
              </div>
            </td>
            <td class="col-actions">
              <button class="btn-action btn-view-sheet" onclick="VocabDashboard.viewQuizSheet('${r.id}')" title="צפה בטופס הבוחן">
                🔍 פירוט
              </button>
              <button class="btn-action btn-delete-res" onclick="VocabDashboard.deleteResult('${r.id}')" title="מחק תוצאה">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderTroubleWords() {
      const container = document.getElementById('trouble-words-container');
      if (!container) return;

      const troubleWords = window.VocabDB.getTroubleWords();

      if (troubleWords.length === 0) {
        container.innerHTML = `
          <div class="empty-trouble-words">
            <span class="celebrate-icon">🌟</span>
            <p><strong>כל הכבוד!</strong> כרגע אין מילים שהתלמידים התקשו בהן באופן עקבי.</p>
            <small>ככל שהתלמידים יבצעו יותר בחנים, כאן יופיעו המילים שטעו בהן לתרגול בתחילת השיעור הבא.</small>
          </div>
        `;
        return;
      }

      // Show top 6 trouble words
      const topTrouble = troubleWords.slice(0, 8);

      container.innerHTML = `
        <div class="trouble-words-grid">
          ${topTrouble.map((tw, idx) => `
            <div class="trouble-word-card">
              <div class="tw-header">
                <span class="tw-rank">#${idx + 1}</span>
                <span class="tw-word">${this.escapeHtml(tw.word)}</span>
                <button class="btn-speak-sm" onclick="VocabQuizEngine.speakWord('${this.escapeHtml(tw.word)}')" title="השמע הגייה">🔊</button>
                <span class="tw-miss-badge">${tw.missedCount} טעויות (${tw.missRate}%)</span>
              </div>
              <div class="tw-details">
                <span class="tw-trans">${this.escapeHtml(tw.translation || '—')}</span>
                ${tw.pos ? `<span class="tw-pos">[${tw.pos}]</span>` : ''}
              </div>
              ${tw.example ? `<div class="tw-example">"${this.escapeHtml(tw.example)}"</div>` : ''}
              <div class="tw-students">
                <small>תלמידים שטעו: ${tw.missedByStudentsList.slice(0, 3).map(s => this.escapeHtml(s)).join(', ')}${tw.missedByStudentsList.length > 3 ? ` ועוד ${tw.missedByStudentsList.length - 3}...` : ''}</small>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    renderStudentRoster() {
      const container = document.getElementById('student-roster-container');
      if (!container) return;

      const students = window.VocabDB.getStudentSummaries();

      if (students.length === 0) {
        container.innerHTML = `<p class="empty-inline">טרם נרשמו תלמידים במערכת.</p>`;
        return;
      }

      container.innerHTML = `
        <div class="roster-grid">
          ${students.map(s => {
            let gradeClass = 'grade-high';
            if (s.averageGrade < 70) gradeClass = 'grade-low';
            else if (s.averageGrade < 90) gradeClass = 'grade-mid';

            return `
              <div class="student-card" onclick="VocabDashboard.viewStudentHistory('${this.escapeHtml(s.name)}')">
                <div class="sc-header">
                  <span class="sc-name">${this.escapeHtml(s.name)}</span>
                  ${s.studentClass ? `<span class="sc-class">${this.escapeHtml(s.studentClass)}</span>` : ''}
                </div>
                <div class="sc-stats">
                  <div class="sc-stat-item">
                    <span class="sc-val">${s.totalQuizzes}</span>
                    <span class="sc-lbl">בחנים</span>
                  </div>
                  <div class="sc-stat-item">
                    <span class="sc-val ${gradeClass}">${s.averageGrade}%</span>
                    <span class="sc-lbl">ממוצע</span>
                  </div>
                  <div class="sc-stat-item">
                    <span class="sc-val">${s.accuracyRate}%</span>
                    <span class="sc-lbl">דיוק</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    static viewQuizSheet(resultId) {
      const results = window.VocabDB.getAllResults();
      const r = results.find(item => item.id === resultId);
      if (!r) return;

      const modal = document.getElementById('modal-quiz-sheet');
      const body = document.getElementById('modal-sheet-content');
      if (!modal || !body) return;

      const dateStr = new Date(r.timestamp).toLocaleString('he-IL');

      body.innerHTML = `
        <div class="sheet-header">
          <h3>פירוט בוחן: ${VocabDashboard.prototype.escapeHtml(r.studentName)}</h3>
          <p><strong>שאלון:</strong> ${VocabDashboard.prototype.escapeHtml(r.quizTitle)}</p>
          <p><strong>תאריך:</strong> ${dateStr} | <strong>ציון סופי:</strong> ${r.percentage}% (${r.score}/${r.total})</p>
        </div>
        <div class="sheet-questions-list">
          ${(r.wordsTested || []).map((w, idx) => `
            <div class="sheet-q-item ${w.isCorrect ? 'item-correct' : 'item-missed'}">
              <div class="sq-num">${idx + 1}</div>
              <div class="sq-main">
                <div class="sq-word-line">
                  <span class="sq-word">${VocabDashboard.prototype.escapeHtml(w.word)}</span>
                  <button class="btn-speak-sm" onclick="VocabQuizEngine.speakWord('${VocabDashboard.prototype.escapeHtml(w.word)}')">🔊</button>
                  <span class="sq-trans">תרגום: <strong>${VocabDashboard.prototype.escapeHtml(w.translation || '—')}</strong></span>
                  ${w.pos ? `<span class="sq-pos">[${w.pos}]</span>` : ''}
                </div>
                ${w.example ? `<p class="sq-example"><em>"${VocabDashboard.prototype.escapeHtml(w.example)}"</em></p>` : ''}
                <div class="sq-answers">
                  <span>תשובת התלמיד: <strong class="${w.isCorrect ? 'text-correct' : 'text-missed'}">${VocabDashboard.prototype.escapeHtml(w.userAnswer || 'ללא מענה')}</strong></span>
                  ${!w.isCorrect ? `<span>תשובה נכונה: <strong class="text-correct">${VocabDashboard.prototype.escapeHtml(w.correctAnswer)}</strong></span>` : ''}
                </div>
              </div>
              <div class="sq-status">
                ${w.isCorrect ? '✓ נכון' : '✗ שגוי'}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      modal.classList.add('active');
    }

    static viewStudentHistory(studentName) {
      const results = window.VocabDB.getAllResults().filter(r => r.studentName === studentName);
      const modal = document.getElementById('modal-student-history');
      const body = document.getElementById('modal-student-content');
      if (!modal || !body) return;

      const total = results.length;
      const avg = total ? Math.round(results.reduce((a, b) => a + b.percentage, 0) / total) : 0;

      // Calculate student's personal missed words
      const missedWords = {};
      results.forEach(r => {
        (r.wordsTested || []).forEach(w => {
          if (!w.isCorrect) {
            missedWords[w.word] = (missedWords[w.word] || 0) + 1;
          }
        });
      });

      const missedSorted = Object.entries(missedWords).sort((a, b) => b[1] - a[1]);

      body.innerHTML = `
        <div class="student-history-header">
          <h3>תיק תלמיד/ה: ${VocabDashboard.prototype.escapeHtml(studentName)}</h3>
          <div class="sh-summary-boxes">
            <div class="sh-box"><span class="sh-num">${total}</span><span>בחנים שבוצעו</span></div>
            <div class="sh-box"><span class="sh-num">${avg}%</span><span>ציון ממוצע</span></div>
            <div class="sh-box"><span class="sh-num">${missedSorted.length}</span><span>מילים לחיזוק</span></div>
          </div>
        </div>

        ${missedSorted.length > 0 ? `
          <div class="sh-section">
            <h4>מילים שהתלמיד/ה טעה/תה בהן:</h4>
            <div class="sh-trouble-chips">
              ${missedSorted.map(([word, count]) => `
                <span class="sh-chip">⚠️ ${VocabDashboard.prototype.escapeHtml(word)} (${count} פעמים)</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="sh-section">
          <h4>היסטוריית בחנים:</h4>
          <table class="sh-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>שאלון / שיעור</th>
                <th>ציון</th>
                <th>פרטים</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(r => `
                <tr>
                  <td>${new Date(r.timestamp).toLocaleDateString('he-IL')}</td>
                  <td>${VocabDashboard.prototype.escapeHtml(r.quizTitle)}</td>
                  <td><strong>${r.percentage}%</strong> (${r.score}/${r.total})</td>
                  <td>
                    <button class="btn-action-sm" onclick="VocabDashboard.viewQuizSheet('${r.id}')">הצג פירוט</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      modal.classList.add('active');
    }

    static deleteResult(resultId) {
      if (confirm('האם את/ה בטוח/ה שברצונך למחוק תוצאת בוחן זו?')) {
        window.VocabDB.deleteResult(resultId);
        window.VocabDashboard.renderDashboard();
      }
    }

    downloadCSV() {
      const csv = window.VocabDB.exportResultsCSV();
      if (!csv) {
        alert('אין נתונים לייצוא עדיין.');
        return;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Module_E_Quiz_Grades_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  window.VocabDashboard = new VocabDashboard();
})();
