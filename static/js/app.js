let currentIndex = 0;
let score = 0;
let total = 0;
let answered = false;
let selectedImage = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function switchInputMode(mode) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (mode === 'text' && btn.textContent.includes('Text')) {
      btn.classList.add('active');
    } else if (mode === 'image' && btn.textContent.includes('Image')) {
      btn.classList.add('active');
    }
  });
  
  // Toggle input mode visibility
  document.querySelectorAll('.input-mode').forEach(el => el.classList.add('hidden'));
  document.getElementById('mode-' + mode).classList.remove('hidden');
  
  // Clear errors
  document.getElementById('input-error').classList.add('hidden');
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Store the file
  selectedImage = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('image-preview').classList.remove('hidden');
    document.getElementById('btn-upload').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function uploadImage() {
  if (!selectedImage) {
    alert("Please select an image first");
    return;
  }
  
  const errEl = document.getElementById('input-error');
  errEl.classList.add('hidden');
  
  const uploadBtn = document.getElementById('btn-upload');
  const uploadText = document.getElementById('upload-text');
  const uploadLoader = document.getElementById('upload-loader');
  uploadBtn.disabled = true;
  uploadText.classList.add('hidden');
  uploadLoader.classList.remove('hidden');
  
  try {
    const formData = new FormData();
    formData.append('image', selectedImage);
    
    const res = await fetch('/upload-image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    
    total = data.total;
    currentIndex = 0;
    score = 0;
    selectedImage = null;
    showScreen('screen-quiz');
    loadQuestion(currentIndex);
  } catch (e) {
    errEl.textContent = "Error: " + e.message;
    errEl.classList.remove('hidden');
  } finally {
    uploadBtn.disabled = false;
    uploadText.classList.remove('hidden');
    uploadLoader.classList.add('hidden');
  }
}

// Drag and drop event listeners
document.addEventListener("DOMContentLoaded", () => {
  const uploadArea = document.getElementById("upload-area");
  if (uploadArea) {
    ["dragenter", "dragover"].forEach(eventName => {
      uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.borderColor = "var(--accent)";
        uploadArea.style.background = "rgba(124, 58, 237, 0.12)";
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.borderColor = "var(--border)";
        uploadArea.style.background = "rgba(124, 58, 237, 0.03)";
      }, false);
    });

    uploadArea.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const fileInput = document.getElementById("image-input");
        fileInput.files = files;
        // Trigger handleImageSelect behavior
        const event = { target: { files: files } };
        handleImageSelect(event);
      }
    }, false);
  }
});


async function startQuiz() {
  const para = document.getElementById('paragraph').value.trim();
  const errEl = document.getElementById('input-error');
  errEl.classList.add('hidden');

  if (para.length < 30) {
    errEl.textContent = "Paragraph too short! Give me more text to work with.";
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-generate');
  const btnText = document.getElementById('btn-text');
  const btnLoader = document.getElementById('btn-loader');
  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');

  try {
    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paragraph: para })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    total = data.total;
    currentIndex = 0;
    score = 0;
    showScreen('screen-quiz');
    loadQuestion(currentIndex);
  } catch (e) {
    errEl.textContent = "Error: " + e.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
}

async function loadQuestion(index) {
  answered = false;
  document.getElementById('feedback').classList.add('hidden');
  document.getElementById('feedback').className = 'feedback hidden';
  document.getElementById('btn-next').classList.add('hidden');
  document.getElementById('options-wrap').innerHTML = '';

  const res = await fetch(`/question/${index}`);
  const data = await res.json();

  if (data.done) {
    showScore();
    return;
  }

  // Progress
  const pct = ((index) / total) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';

  // Badge
  const badge = document.getElementById('q-type-badge');
  badge.textContent = data.type === 'mcq' ? 'MCQ' : 'TRUE / FALSE';

  document.getElementById('q-counter').textContent = `Q ${index + 1} / ${total}`;
  document.getElementById('q-text').textContent = data.question;

  // Render options
  const wrap = document.getElementById('options-wrap');
  data.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.onclick = () => selectAnswer(opt, index);
    wrap.appendChild(btn);
  });
}

async function selectAnswer(answer, index) {
  if (answered) return;
  answered = true;

  const res = await fetch('/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, answer })
  });
  const data = await res.json();

  // Highlight options
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent.trim() === data.correct_answer.trim()) {
      btn.classList.add('correct');
    } else if (btn.textContent.trim() === answer && !data.correct) {
      btn.classList.add('wrong');
    }
  });

  // Feedback
  const fb = document.getElementById('feedback');
  if (data.correct) {
    score++;
    fb.textContent = "✅ Correct!";
    fb.className = 'feedback correct-fb';
  } else {
    fb.textContent = `❌ Wrong! Correct: ${data.correct_answer}`;
    fb.className = 'feedback wrong-fb';
  }
  fb.classList.remove('hidden');

  document.getElementById('btn-next').classList.remove('hidden');
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= total) {
    showScore();
  } else {
    loadQuestion(currentIndex);
  }
}

function showScore() {
  document.getElementById('progress-bar').style.width = '100%';
  const pct = Math.round((score / total) * 100);
  document.getElementById('score-num').textContent = score;
  document.getElementById('score-total').textContent = `/${total}`;

  let label, msg;
  if (pct === 100) { label = "Perfect! 🏆"; msg = "You got everything right. Absolute legend!"; }
  else if (pct >= 80) { label = "Great job! 🎉"; msg = "Almost perfect. Really solid work!"; }
  else if (pct >= 60) { label = "Not bad! 👍"; msg = "Good effort. Review the ones you missed."; }
  else if (pct >= 40) { label = "Keep trying! 💪"; msg = "Read the paragraph again and retry!"; }
  else { label = "Oops! 😅"; msg = "Rough one! Try reading more carefully."; }

  document.getElementById('score-label').textContent = label;
  document.getElementById('score-msg').textContent = msg;
  showScreen('screen-score');
}

function resetApp() {
  document.getElementById('paragraph').value = '';
  document.getElementById('input-error').classList.add('hidden');
  showScreen('screen-input');
}
