// ============================================
// ENGLISH TEACHER AI APP
// ============================================

// State Management
let currentSessionId = null;
let sessions = [];
let mistakes = [];
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let synthesis = window.speechSynthesis;
let apiKey = localStorage.getItem('anthropic_api_key') || '';
// Configurable Anthropic model (can be overridden in browser devtools/localStorage)
let MODEL = localStorage.getItem('anthropic_model') || 'claude-sonnet-4-5';

function getModel() {
    return localStorage.getItem('anthropic_model') || MODEL;
}

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const micButton = document.getElementById('micButton');
const recordingIndicator = document.getElementById('recordingIndicator');
const chatMessages = document.getElementById('chatMessages');
const sessionMenuBtn = document.getElementById('sessionMenuBtn');
const newSessionBtn = document.getElementById('newSessionBtn');
const sessionSidebar = document.getElementById('sessionSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const sessionList = document.getElementById('sessionList');
const currentSessionName = document.getElementById('currentSessionName');
const loadingOverlay = document.getElementById('loadingOverlay');
const transcriptEditor = document.getElementById('transcriptEditor');
const transcriptText = document.getElementById('transcriptText');
const submitBtn = document.getElementById('submitBtn');
const discardBtn = document.getElementById('discardBtn');
const mistakesTableBody = document.getElementById('mistakesTableBody');
const mistakeSearch = document.getElementById('mistakeSearch');
const categoryFilter = document.getElementById('categoryFilter');
const exportBtn = document.getElementById('exportBtn');
const levelSelect = document.getElementById('levelSelect');

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeApp();
    setupEventListeners();
    updateUI();
});

function initializeApp() {
    // Create default session if none exists
    if (sessions.length === 0) {
        createNewSession("Today's Practice");
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Tab navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Voice input
    micButton.addEventListener('click', toggleRecording);
    
    // Session management
    sessionMenuBtn.addEventListener('click', () => sessionSidebar.classList.add('open'));
    closeSidebar.addEventListener('click', () => sessionSidebar.classList.remove('open'));
    newSessionBtn.addEventListener('click', () => {
        const name = prompt('Enter session name:', `Session ${sessions.length + 1}`);
        if (name) createNewSession(name);
    });
    
    // Transcript editor
    submitBtn.addEventListener('click', () => {
        const text = transcriptText.value.trim();
        if (text) {
            transcriptEditor.style.display = 'none';
            transcriptText.value = '';
            handleUserSpeech(text);
        }
    });
    discardBtn.addEventListener('click', () => {
        transcriptEditor.style.display = 'none';
        transcriptText.value = '';
        accumulatedTranscript = '';
    });

    // Mistakes tab
    mistakeSearch.addEventListener('input', filterMistakes);
    categoryFilter.addEventListener('change', filterMistakes);
    exportBtn.addEventListener('click', exportMistakes);
    
    // Tips tab
    levelSelect.addEventListener('change', updateTips);
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    tabPanes.forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });
    
    if (tabName === 'mistakes') {
        renderMistakesTable();
    } else if (tabName === 'tips') {
        updateTips();
        updateProgressStats();
    }
}

// ============================================
// AUDIO RECORDING + WHISPER TRANSCRIPTION
// ============================================

async function toggleRecording() {
    if (isRecording) {
        isRecording = false;
        mediaRecorder.stop();
        micButton.classList.remove('recording');
        micButton.querySelector('.mic-text').textContent = 'Tap to Speak';
        micButton.querySelector('.mic-icon').textContent = '🎤';
        recordingIndicator.classList.remove('active');
        if (synthesis) synthesis.cancel();
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            transcriptEditor.style.display = 'none';
            transcriptText.value = '';

            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                await transcribeAudio(audioBlob, mimeType);
            };

            mediaRecorder.start();
            isRecording = true;
            micButton.classList.add('recording');
            micButton.querySelector('.mic-text').textContent = 'Tap to Stop';
            micButton.querySelector('.mic-icon').textContent = '⏹️';
            recordingIndicator.classList.add('active');
        } catch (err) {
            alert('Microphone access denied. Please allow microphone permissions.');
        }
    }
}

async function transcribeAudio(audioBlob, mimeType) {
    const loadingText = loadingOverlay.querySelector('p');

    try {
        let ext = 'webm';
        if (mimeType.includes('ogg')) ext = 'ogg';
        else if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'mp4';
        else if (mimeType.includes('wav')) ext = 'wav';
        else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';

        console.log('Audio mimeType:', mimeType, '→ ext:', ext, 'size:', audioBlob.size);

        if (audioBlob.size < 1000) {
            alert('Recording too short — please speak for at least 1 second.');
            return;
        }

        loadingText.textContent = 'Transcribing...';
        loadingOverlay.classList.add('active');

        const formData = new FormData();
        formData.append('file', audioBlob, `audio.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('prompt', 'The following is a spoken English sentence by a non-native speaker.');
        formData.append('temperature', '0');

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Transcription failed');
        }

        const data = await response.json();
        const transcript = data.text?.trim();

        loadingOverlay.classList.remove('active');

        if (transcript) {
            // Show transcript in editor first so user can verify before sending
            transcriptText.value = transcript;
            transcriptEditor.style.display = 'block';
            transcriptText.focus();
        }
    } catch (error) {
        loadingOverlay.classList.remove('active');
        loadingText.textContent = 'Processing...';
        alert('Transcription error: ' + error.message);
    }
}

// ============================================
// MESSAGE HANDLING
// ============================================

async function handleUserSpeech(text) {
    // Add user message to chat
    addMessageToChat('user', text);
    
    // Show loading
    loadingOverlay.classList.add('active');
    
    try {
        // Get AI response
        const response = await getAICorrection(text);
        
        // Add AI response to chat
        addMessageToChat('ai', response);
        
        // Save to session
        saveMessageToSession(text, response);
        
        // Speak the correction
        speakText(response.corrected || response.message);
        
    } catch (error) {
        console.error('Error getting AI response:', error);
        alert('Error: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('active');
    }
}

function addMessageToChat(type, content) {
    // Remove welcome message if exists
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="message-user">
                <div class="message-label">You said:</div>
                <div class="message-text">${content}</div>
            </div>
        `;
    } else {
        const { original, corrected, explanation, category } = content;
        messageDiv.innerHTML = `
            <div class="message-ai">
                <div class="message-label">🎓 SpeakMint:</div>
                ${corrected ? `
                    <div class="correction-box">
                        <div class="correction-label">✓ Improved Version:</div>
                        <div class="correction-text">"${corrected}"</div>
                        <div class="explanation">${explanation}</div>
                    </div>
                    <div class="message-actions">
                        <button class="listen-btn" onclick="speakText('${corrected.replace(/'/g, "\\'")}')">
                            🔊 Listen
                        </button>
                        <button class="retry-btn" onclick="showRetryEditor(this, '${(original || '').replace(/'/g, "\\'")}')">
                            ✏️ Edit & Retry
                        </button>
                    </div>
                ` : `
                    <div class="message-text">${content.explanation || content.message || 'Great job! Your sentence is perfect.'}</div>
                    <div class="message-actions">
                        <button class="retry-btn" onclick="showRetryEditor(this, '${(original || '').replace(/'/g, "\\'")}')">
                            ✏️ Edit & Retry
                        </button>
                    </div>
                `}
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showRetryEditor(btn, originalText) {
    // Remove any existing inline editors
    document.querySelectorAll('.inline-retry-editor').forEach(e => e.remove());

    const editor = document.createElement('div');
    editor.className = 'inline-retry-editor';
    editor.innerHTML = `
        <textarea class="retry-textarea">${originalText}</textarea>
        <div class="transcript-actions">
            <button class="discard-btn" onclick="this.closest('.inline-retry-editor').remove()">Cancel</button>
            <button class="submit-btn" onclick="submitRetry(this)">Send ➤</button>
        </div>
    `;
    btn.closest('.message-actions').after(editor);
    editor.querySelector('textarea').focus();
}

function submitRetry(btn) {
    const text = btn.closest('.inline-retry-editor').querySelector('textarea').value.trim();
    if (text) {
        btn.closest('.inline-retry-editor').remove();
        handleUserSpeech(text);
    }
}

window.showRetryEditor = showRetryEditor;
window.submitRetry = submitRetry;

// ============================================
// AI INTEGRATION (ANTHROPIC CLAUDE)
// ============================================

async function getAICorrection(text) {
    const prompt = `You are an expert English speaking coach helping a non-native speaker improve their spoken English. The student said: "${text}"

Your job is to help them sound more natural, fluent, and advanced in spoken English. Focus ONLY on:
- Word choice (e.g. wrong preposition, wrong word used, unnatural phrasing)
- Vocabulary advancement (suggest a more precise or natural word/phrase a native speaker would use)
- Grammar errors that affect meaning or sound unnatural when spoken
- Clearer or more idiomatic ways to express the same idea

DO NOT correct or mention:
- Punctuation (the student is speaking, not writing)
- Sentence length or run-on sentences (natural in speech)
- Written style conventions

If the sentence is correct and natural for spoken English, say so positively even if it wouldn't be perfect in writing.

Respond in JSON format:
{
    "original": "${text}",
    "corrected": "improved spoken version, or null if already natural",
    "explanation": "brief, specific explanation of what to change and why — focus on how a native speaker would say it",
    "category": "vocabulary/grammar/phrasing or null",
    "isPerfect": true/false
}`;

    try {
        // Use proxy server instead of direct API call
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
                body: JSON.stringify({
                model: getModel(),
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        const content = data.content[0].text;
        
        // Try to parse JSON response
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                
                // Save mistake if not perfect
                if (!result.isPerfect && result.corrected) {
                    saveMistake(result);
                }
                
                return result;
            }
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
        
        // Fallback if JSON parsing fails
        return {
            original: text,
            message: content,
            isPerfect: true
        };
        
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// TEXT-TO-SPEECH
// ============================================

function speakText(text) {
    if (!synthesis) {
        alert('Text-to-speech not supported');
        return;
    }
    
    // Cancel any ongoing speech
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    synthesis.speak(utterance);
}

// Make speakText available globally for onclick handlers
window.speakText = speakText;

// ============================================
// SESSION MANAGEMENT
// ============================================

function createNewSession(name) {
    const session = {
        id: Date.now(),
        name: name,
        createdAt: new Date().toISOString(),
        messages: []
    };
    
    sessions.push(session);
    currentSessionId = session.id;
    
    saveData();
    updateSessionList();
    clearChat();
    currentSessionName.textContent = name;
    sessionSidebar.classList.remove('open');
}

function switchSession(sessionId) {
    currentSessionId = sessionId;
    const session = sessions.find(s => s.id === sessionId);
    
    if (session) {
        currentSessionName.textContent = session.name;
        loadSessionMessages(session);
        updateSessionList();
        sessionSidebar.classList.remove('open');
    }
}

function deleteSession(sessionId) {
    if (sessions.length === 1) {
        alert('Cannot delete the last session');
        return;
    }
    
    if (!confirm('Delete this session? This cannot be undone.')) {
        return;
    }
    
    sessions = sessions.filter(s => s.id !== sessionId);
    
    if (currentSessionId === sessionId) {
        currentSessionId = sessions[0].id;
        switchSession(currentSessionId);
    }
    
    saveData();
    updateSessionList();
}

function updateSessionList() {
    sessionList.innerHTML = '';
    
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
        item.innerHTML = `
            <div class="session-info">
                <div class="session-name">${session.name}</div>
                <div class="session-meta">${new Date(session.createdAt).toLocaleDateString()}, ${session.messages.length} messages</div>
            </div>
            ${sessions.length > 1 ? `<button class="delete-session" onclick="deleteSession(${session.id})">×</button>` : ''}
        `;
        
        item.querySelector('.session-info').addEventListener('click', () => switchSession(session.id));
        sessionList.appendChild(item);
    });
}

function saveMessageToSession(userText, aiResponse) {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
        session.messages.push({
            timestamp: new Date().toISOString(),
            user: userText,
            ai: aiResponse
        });
        saveData();
    }
}

function loadSessionMessages(session) {
    clearChat();
    
    session.messages.forEach(msg => {
        addMessageToChat('user', msg.user);
        addMessageToChat('ai', msg.ai);
    });
}

function clearChat() {
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <h2>👋 Welcome!</h2>
            <p>Tap the microphone button below and speak in English.</p>
            <p>I'll help you improve your grammar, vocabulary, and style!</p>
        </div>
    `;
}

// Make deleteSession available globally
window.deleteSession = deleteSession;

// ============================================
// MISTAKES MANAGEMENT
// ============================================

function saveMistake(correction) {
    const mistake = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        original: correction.original,
        corrected: correction.corrected,
        explanation: correction.explanation,
        category: correction.category || 'general'
    };
    
    mistakes.push(mistake);
    saveData();
}

function renderMistakesTable() {
    if (mistakes.length === 0) {
        mistakesTableBody.innerHTML = `
            <tr class="no-data">
                <td colspan="6">No mistakes recorded yet. Start chatting to see your improvements!</td>
            </tr>
        `;
        return;
    }
    
    const filtered = filterMistakesData();
    
    mistakesTableBody.innerHTML = filtered.map(mistake => `
        <tr>
            <td>${new Date(mistake.timestamp).toLocaleDateString()}</td>
            <td>${mistake.original}</td>
            <td>${mistake.corrected}</td>
            <td>${mistake.explanation}</td>
            <td><span class="category-badge category-${mistake.category}">${mistake.category}</span></td>
            <td><button class="delete-mistake" onclick="deleteMistake(${mistake.id})">Delete</button></td>
        </tr>
    `).join('');
}

function filterMistakesData() {
    let filtered = [...mistakes];
    
    const searchTerm = mistakeSearch.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(m => 
            m.original.toLowerCase().includes(searchTerm) ||
            m.corrected.toLowerCase().includes(searchTerm) ||
            m.explanation.toLowerCase().includes(searchTerm)
        );
    }
    
    const category = categoryFilter.value;
    if (category !== 'all') {
        filtered = filtered.filter(m => m.category === category);
    }
    
    return filtered.reverse(); // Most recent first
}

function filterMistakes() {
    renderMistakesTable();
}

function deleteMistake(id) {
    if (!confirm('Delete this mistake record?')) return;
    
    mistakes = mistakes.filter(m => m.id !== id);
    saveData();
    renderMistakesTable();
}

function exportMistakes() {
    if (mistakes.length === 0) {
        alert('No mistakes to export');
        return;
    }
    
    const csv = [
        ['Date', 'What You Said', 'Improved Version', 'Explanation', 'Category'],
        ...mistakes.map(m => [
            new Date(m.timestamp).toLocaleDateString(),
            m.original,
            m.corrected,
            m.explanation,
            m.category
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-mistakes-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// Make deleteMistake available globally
window.deleteMistake = deleteMistake;

// ============================================
// TIPS & PROGRESS
// ============================================

function updateTips() {
    const level = levelSelect.value;
    updateCommonMistakes();
    updateGrammarTips(level);
    updateVocabularyTips(level);
}

function updateCommonMistakes() {
    const commonMistakesDiv = document.getElementById('commonMistakes');
    
    if (mistakes.length === 0) {
        commonMistakesDiv.innerHTML = '<p class="tips-placeholder">Start practicing to see your common mistakes here!</p>';
        return;
    }
    
    // Count mistakes by category
    const categoryCounts = {};
    mistakes.forEach(m => {
        categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
    });
    
    const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    commonMistakesDiv.innerHTML = sorted.map(([category, count]) => `
        <div class="tip-card">
            <div class="tip-title">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
            <div class="tip-content">You've made ${count} ${category} mistakes. Focus on improving this area!</div>
        </div>
    `).join('');
}

function updateGrammarTips(level) {
    const tips = {
        beginner: [
            { title: 'Subject-Verb Agreement', content: 'Remember: "He goes" not "He go". The verb changes with the subject.' },
            { title: 'Articles (a, an, the)', content: 'Use "a" before consonants, "an" before vowels, "the" for specific things.' },
            { title: 'Present Simple vs Continuous', content: '"I work" (habit) vs "I am working" (now).' }
        ],
        intermediate: [
            { title: 'Past Perfect Tense', content: 'Use "had + past participle" for actions before another past action.' },
            { title: 'Conditional Sentences', content: 'If + past simple, would + verb (If I had time, I would help).' },
            { title: 'Phrasal Verbs', content: 'Learn common phrasal verbs like "give up", "look after", "put off".' }
        ],
        advanced: [
            { title: 'Subjunctive Mood', content: 'Use for hypothetical situations: "If I were you..." (not "was").' },
            { title: 'Inversion for Emphasis', content: '"Never have I seen..." instead of "I have never seen..."' },
            { title: 'Cleft Sentences', content: 'Use "It is... that..." or "What... is..." for emphasis.' }
        ]
    };
    
    const grammarTipsDiv = document.getElementById('grammarTips');
    grammarTipsDiv.innerHTML = tips[level].map(tip => `
        <div class="tip-card">
            <div class="tip-title">${tip.title}</div>
            <div class="tip-content">${tip.content}</div>
        </div>
    `).join('');
}

function updateVocabularyTips(level) {
    const tips = {
        beginner: [
            { title: 'Daily Routines', content: 'Learn: wake up, get dressed, have breakfast, go to work, etc.' },
            { title: 'Common Adjectives', content: 'big, small, good, bad, happy, sad, hot, cold, new, old' }
        ],
        intermediate: [
            { title: 'Business English', content: 'meeting, deadline, presentation, colleague, client, schedule' },
            { title: 'Expressing Opinions', content: 'In my opinion, I believe, It seems to me, From my perspective' }
        ],
        advanced: [
            { title: 'Idiomatic Expressions', content: 'piece of cake, break the ice, hit the nail on the head' },
            { title: 'Academic Vocabulary', content: 'furthermore, nevertheless, consequently, thereby, wherein' }
        ]
    };
    
    const vocabTipsDiv = document.getElementById('vocabularyTips');
    vocabTipsDiv.innerHTML = tips[level].map(tip => `
        <div class="tip-card">
            <div class="tip-title">${tip.title}</div>
            <div class="tip-content">${tip.content}</div>
        </div>
    `).join('');
}

function updateProgressStats() {
    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('totalMistakes').textContent = mistakes.length;
    
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    document.getElementById('totalMessages').textContent = totalMessages;
}

// ============================================
// DATA PERSISTENCE
// ============================================

function saveData() {
    localStorage.setItem('sessions', JSON.stringify(sessions));
    localStorage.setItem('mistakes', JSON.stringify(mistakes));
}

function loadData() {
    const savedSessions = localStorage.getItem('sessions');
    const savedMistakes = localStorage.getItem('mistakes');
    
    if (savedSessions) {
        sessions = JSON.parse(savedSessions);
        if (sessions.length > 0) {
            currentSessionId = sessions[0].id;
            switchSession(currentSessionId);
        }
    }
    
    if (savedMistakes) {
        mistakes = JSON.parse(savedMistakes);
    }
}

function updateUI() {
    updateSessionList();
    renderMistakesTable();
    updateTips();
    updateProgressStats();
}
