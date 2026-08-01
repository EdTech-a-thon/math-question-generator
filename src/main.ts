import "./style.css";

type Operation = "add" | "subtract" | "multiply" | "divide" | "custom";

type Question = {
  id: number;
  operation: Operation;
  seed: number;
  customPrompt?: string;
  customAnswer?: string;
};

type Quiz = {
  title: string;
  subject: string;
  versions: number;
  questions: Question[];
};

type RenderedQuestion = { prompt: string; answer: string };

const app = document.querySelector<HTMLDivElement>("#app")!;
let mode: "teacher" | "student" = "teacher";
let editingId: number | null = null;
let publishedQuiz: Quiz | null = loadPublishedQuiz();
let score: number | null = null;
let answers: Record<number, string> = {};

let quiz: Quiz = {
  title: "Expressions & Equations Check-in",
  subject: "Algebra I",
  versions: 3,
  questions: [
    { id: 1, operation: "add", seed: 14 },
    { id: 2, operation: "subtract", seed: 27 },
    { id: 3, operation: "multiply", seed: 38 },
    { id: 4, operation: "divide", seed: 49 },
    {
      id: 5,
      operation: "custom",
      seed: 50,
      customPrompt: "Evaluate -8 + 3.",
      customAnswer: "-5",
    },
  ],
};

function loadPublishedQuiz(): Quiz | null {
  try {
    const saved = localStorage.getItem("chalkboard-published-quiz");
    return saved ? (JSON.parse(saved) as Quiz) : null;
  } catch {
    return null;
  }
}

function cloneQuiz(source: Quiz): Quiz {
  return JSON.parse(JSON.stringify(source)) as Quiz;
}

function randomFrom(seed: number, salt: number): number {
  const value = Math.sin(seed * 91.17 + salt * 47.31) * 10000;
  return value - Math.floor(value);
}

function numberBetween(seed: number, salt: number, min: number, max: number): number {
  return Math.floor(randomFrom(seed, salt) * (max - min + 1)) + min;
}

function renderQuestion(question: Question, versionIndex = 0): RenderedQuestion {
  if (question.operation === "custom") {
    return {
      prompt: question.customPrompt || "Untitled question",
      answer: question.customAnswer || "",
    };
  }

  const versionSeed = question.seed + versionIndex * 997;
  const a = numberBetween(versionSeed, 1, 3, 18);
  const b = numberBetween(versionSeed, 2, 2, 12);

  if (question.operation === "add") {
    return { prompt: `Solve for x: x + ${a} = ${a + b}`, answer: String(b) };
  }

  if (question.operation === "subtract") {
    const result = numberBetween(versionSeed, 3, -9, 8);
    return { prompt: `Solve for x: x - ${a} = ${result}`, answer: String(result + a) };
  }

  if (question.operation === "multiply") {
    return { prompt: `Solve for x: ${b}x = ${a * b}`, answer: String(a) };
  }

  const quotient = numberBetween(versionSeed, 4, 2, 14);
  return { prompt: `Evaluate: ${quotient * b} ÷ ${b}`, answer: String(quotient) };
}

function operationLabel(operation: Operation): string {
  const labels: Record<Operation, string> = {
    add: "Addition equation",
    subtract: "Subtraction equation",
    multiply: "Multiplication equation",
    divide: "Division problem",
    custom: "Custom question",
  };
  return labels[operation];
}

function render(): void {
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">Q</div>
        <div><strong>Chalkboard</strong><small>Quiz studio</small></div>
      </div>
      <nav class="mode-switch" aria-label="Choose a mode">
        <button data-mode="teacher" class="${mode === "teacher" ? "active" : ""}">Teacher mode</button>
        <button data-mode="student" class="${mode === "student" ? "active" : ""}">Student mode</button>
      </nav>
    </header>
    ${mode === "teacher" ? teacherView() : studentView()}
  `;

  bindSharedEvents();
  if (mode === "teacher") bindTeacherEvents();
  else bindStudentEvents();
}

function teacherView(): string {
  return `
    <main class="shell">
      <section class="hero">
        <div><span class="eyebrow">Teacher workspace</span><h1>Build one quiz.<br>Make every copy unique.</h1></div>
        <p>Create parallel versions in a few clicks. The structure stays consistent while the numbers change, so every student gets a fair challenge.</p>
      </section>
      <div class="workspace">
        <aside class="panel setup">
          <h2>Quiz setup</h2>
          <div class="field"><label for="quiz-title">Quiz title</label><input id="quiz-title" value="${escapeHtml(quiz.title)}"></div>
          <div class="field"><label for="quiz-subject">Class or subject</label><input id="quiz-subject" value="${escapeHtml(quiz.subject)}"></div>
          <div class="field">
            <label>Number of versions</label>
            <div class="versions" role="group" aria-label="Number of quiz versions">
              ${[1, 2, 3, 4, 5, 6].map((count) => `<button data-versions="${count}" class="${quiz.versions === count ? "active" : ""}">${count}</button>`).join("")}
            </div>
          </div>
          <p class="hint">Each version uses the same skills with different numbers. Custom questions remain unchanged.</p>
          <div class="stat"><span>Questions</span><strong>${quiz.questions.length}</strong></div>
          <div class="stat"><span>Copies created</span><strong>${quiz.questions.length * quiz.versions}</strong></div>
        </aside>
        <section class="panel quiz-panel">
          <div class="quiz-head">
            <div><h2>Version A preview</h2><p>Use the controls beside a question to edit or refresh it.</p></div>
            <button class="btn btn-ghost" id="print-quiz">Download PDF</button>
          </div>
          <div class="questions">${quiz.questions.map(questionRow).join("")}</div>
          <div class="add-row"><button class="btn btn-primary" id="add-question">+ Add question</button><button class="btn btn-ghost" id="randomize-all">Randomize all</button></div>
          <div class="publish-bar">
            <div><strong>Ready for your class?</strong><span>Publish the final version for students to take.</span></div>
            <button class="btn" id="publish-quiz">Publish quiz</button>
          </div>
        </section>
      </div>
    </main>
  `;
}

function questionRow(question: Question, index: number): string {
  const rendered = renderQuestion(question);
  const editing = editingId === question.id;
  return `
    <article class="question" data-question-id="${question.id}">
      <div class="number">${index + 1}</div>
      <div><div class="question-text">${escapeHtml(rendered.prompt)}</div><div class="answer-key">Answer: ${escapeHtml(rendered.answer)} · ${operationLabel(question.operation)}</div></div>
      <div class="actions">
        <button class="icon-btn edit-question" title="Edit question" aria-label="Edit question ${index + 1}">Edit</button>
        <button class="icon-btn randomize-question" title="Use new numbers" aria-label="Randomize question ${index + 1}">↻</button>
        <button class="icon-btn remove-question" title="Remove question" aria-label="Remove question ${index + 1}">×</button>
      </div>
      ${editing ? editFields(question, rendered) : ""}
    </article>
  `;
}

function editFields(question: Question, rendered: RenderedQuestion): string {
  return `
    <div class="question-edit">
      <div class="field"><label for="edit-prompt">Question</label><textarea id="edit-prompt">${escapeHtml(rendered.prompt)}</textarea></div>
      <div class="field"><label for="edit-answer">Accepted answer</label><input id="edit-answer" value="${escapeHtml(rendered.answer)}"></div>
      <button class="btn btn-secondary save-edit">Save question</button>
    </div>
  `;
}

function studentView(): string {
  if (!publishedQuiz) {
    return `<main class="shell"><section class="panel empty"><span class="eyebrow">Student mode</span><h2>No quiz has been published yet</h2><p>Switch to Teacher mode, finish the quiz, and select Publish quiz.</p><button class="btn btn-primary" data-mode="teacher">Go to teacher mode</button></section></main>`;
  }

  return `
    <main class="shell">
      <section class="panel student-card">
        <div class="student-title"><span class="eyebrow">Student quiz · Version A</span><h1>${escapeHtml(publishedQuiz.title)}</h1><div class="student-meta"><span>${escapeHtml(publishedQuiz.subject)}</span><span>${publishedQuiz.questions.length} questions</span><span>Name: ____________________</span></div></div>
        <form class="student-form" id="student-form">
          ${publishedQuiz.questions.map((question, index) => studentQuestion(question, index)).join("")}
          <div class="student-submit">${score === null ? "<span>Check your work before submitting.</span>" : `<div class="score">Score: ${score} / ${publishedQuiz.questions.length}</div>`}<button class="btn btn-primary" type="submit">${score === null ? "Submit answers" : "Check again"}</button></div>
        </form>
      </section>
    </main>
  `;
}

function studentQuestion(question: Question, index: number): string {
  const rendered = renderQuestion(question);
  const value = answers[question.id] || "";
  const state = score === null ? "" : answersMatch(value, rendered.answer) ? "correct" : "wrong";
  const feedback = score === null ? "" : state === "correct" ? "Correct" : `Try again. The expected answer is ${escapeHtml(rendered.answer)}.`;
  return `<div class="student-question ${state}"><label for="answer-${question.id}"><strong>${index + 1}.</strong> ${escapeHtml(rendered.prompt)}</label><input id="answer-${question.id}" data-answer-id="${question.id}" value="${escapeHtml(value)}" autocomplete="off" placeholder="Your answer"><span class="feedback">${feedback}</span></div>`;
}

function bindSharedEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode as "teacher" | "student";
      editingId = null;
      score = null;
      answers = {};
      render();
    });
  });
}

function bindTeacherEvents(): void {
  document.querySelector<HTMLInputElement>("#quiz-title")?.addEventListener("input", (event) => {
    quiz.title = (event.target as HTMLInputElement).value;
  });
  document.querySelector<HTMLInputElement>("#quiz-subject")?.addEventListener("input", (event) => {
    quiz.subject = (event.target as HTMLInputElement).value;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-versions]").forEach((button) => {
    button.addEventListener("click", () => {
      quiz.versions = Number(button.dataset.versions);
      render();
    });
  });
  document.querySelectorAll<HTMLElement>("[data-question-id]").forEach((row) => {
    const id = Number(row.dataset.questionId);
    row.querySelector(".edit-question")?.addEventListener("click", () => {
      editingId = editingId === id ? null : id;
      render();
    });
    row.querySelector(".randomize-question")?.addEventListener("click", () => {
      const question = quiz.questions.find((item) => item.id === id);
      if (!question) return;
      if (question.operation === "custom") {
        showToast("Custom questions stay fixed. Edit it to change the numbers.");
        return;
      }
      question.seed = Math.floor(Math.random() * 100000);
      render();
    });
    row.querySelector(".remove-question")?.addEventListener("click", () => {
      quiz.questions = quiz.questions.filter((item) => item.id !== id);
      render();
    });
    row.querySelector(".save-edit")?.addEventListener("click", () => {
      const question = quiz.questions.find((item) => item.id === id);
      const prompt = row.querySelector<HTMLTextAreaElement>("#edit-prompt")?.value.trim();
      const answer = row.querySelector<HTMLInputElement>("#edit-answer")?.value.trim();
      if (!question || !prompt || !answer) {
        showToast("Add both a question and an accepted answer.");
        return;
      }
      question.operation = "custom";
      question.customPrompt = prompt;
      question.customAnswer = answer;
      editingId = null;
      render();
    });
  });
  document.querySelector("#add-question")?.addEventListener("click", addQuestion);
  document.querySelector("#randomize-all")?.addEventListener("click", randomizeAll);
  document.querySelector("#publish-quiz")?.addEventListener("click", publishQuiz);
  document.querySelector("#print-quiz")?.addEventListener("click", printQuiz);
}

function addQuestion(): void {
  const operations: Operation[] = ["add", "subtract", "multiply", "divide"];
  const id = Math.max(0, ...quiz.questions.map((question) => question.id)) + 1;
  quiz.questions.push({
    id,
    operation: operations[quiz.questions.length % operations.length],
    seed: Math.floor(Math.random() * 100000),
  });
  render();
}

function randomizeAll(): void {
  quiz.questions.forEach((question) => {
    if (question.operation !== "custom") question.seed = Math.floor(Math.random() * 100000);
  });
  render();
}

function publishQuiz(): void {
  if (!quiz.title.trim() || quiz.questions.length === 0) {
    showToast("Give the quiz a title and at least one question first.");
    return;
  }
  publishedQuiz = cloneQuiz(quiz);
  localStorage.setItem("chalkboard-published-quiz", JSON.stringify(publishedQuiz));
  showToast("Quiz published. It is ready in Student mode.");
}

function printQuiz(): void {
  if (quiz.questions.length === 0) {
    showToast("Add at least one question before downloading.");
    return;
  }
  document.querySelector(".print-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.className = "print-sheet";
  sheet.innerHTML = Array.from({ length: quiz.versions }, (_, versionIndex) => `
    <section class="print-version">
      <div class="print-header"><h1>${escapeHtml(quiz.title)}</h1><div class="print-meta"><span>${escapeHtml(quiz.subject)} · Version ${String.fromCharCode(65 + versionIndex)}</span><span>Name: __________________________ &nbsp; Date: __________</span></div></div>
      ${quiz.questions.map((question, index) => `<div class="print-question"><strong>${index + 1}.</strong> ${escapeHtml(renderQuestion(question, versionIndex).prompt)}<div class="answer-line"></div></div>`).join("")}
    </section>
  `).join("");
  document.body.append(sheet);
  window.print();
}

function bindStudentEvents(): void {
  document.querySelectorAll<HTMLInputElement>("[data-answer-id]").forEach((input) => {
    input.addEventListener("input", () => {
      answers[Number(input.dataset.answerId)] = input.value;
    });
  });
  document.querySelector<HTMLFormElement>("#student-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!publishedQuiz) return;
    score = publishedQuiz.questions.reduce((total, question) => {
      return total + (answersMatch(answers[question.id] || "", renderQuestion(question).answer) ? 1 : 0);
    }, 0);
    render();
  });
}

function answersMatch(studentAnswer: string, expectedAnswer: string): boolean {
  const normalize = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");
  return normalize(studentAnswer) === normalize(expectedAnswer);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

function showToast(message: string): void {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3000);
}

render();
