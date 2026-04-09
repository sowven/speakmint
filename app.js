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
const levelSelect = document.getElementById('levelSelect'); // may be null after redesign

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
    
    // Mistakes tab
    mistakeSearch.addEventListener('input', filterMistakes);
    categoryFilter.addEventListener('change', filterMistakes);
    exportBtn.addEventListener('click', exportMistakes);
    
    // Tips tab
    if (levelSelect) levelSelect.addEventListener('change', updateTips);
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
    loadingText.textContent = 'Transcribing...';
    loadingOverlay.classList.add('active');

    try {
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
        const formData = new FormData();
        formData.append('file', audioBlob, `audio.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');

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

        if (transcript) {
            await handleUserSpeech(transcript);
        }
    } catch (error) {
        alert('Transcription error: ' + error.message);
    } finally {
        loadingText.textContent = 'Processing...';
        loadingOverlay.classList.remove('active');
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

function formatTimestamp(date) {
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function addMessageToChat(type, content, timestamp) {
    // Remove welcome message if exists
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    const ts = formatTimestamp(timestamp ? new Date(timestamp) : new Date());

    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="message-user">
                <div class="message-label">You said: <span class="message-timestamp">${ts}</span></div>
                <div class="message-text">${content}</div>
            </div>
        `;
    } else {
        const { original, formal, natural, explanation, category } = content;
        const hasCorrections = formal || natural;
        const escapedOriginal = (original || '').replace(/'/g, "\\'");
        messageDiv.innerHTML = `
            <div class="message-ai">
                <div class="message-label">🎓 SpeakMint: <span class="message-timestamp">${ts}</span></div>
                ${hasCorrections ? `
                    ${formal ? `
                    <div class="correction-box">
                        <div class="correction-label">🎩 Formal / Professional:</div>
                        <div class="correction-text">"${formal}"</div>
                        <button class="listen-btn small" onclick="speakText('${formal.replace(/'/g, "\\'")}')">🔊 Listen</button>
                    </div>` : ''}
                    ${natural ? `
                    <div class="correction-box" style="margin-top:10px">
                        <div class="correction-label">💬 Natural / Conversational:</div>
                        <div class="correction-text">"${natural}"</div>
                        <button class="listen-btn small" onclick="speakText('${natural.replace(/'/g, "\\'")}')">🔊 Listen</button>
                    </div>` : ''}
                    <div class="explanation" style="margin-top:8px">${explanation}</div>
                    <div class="message-actions">
                        <button class="retry-btn" onclick="showRetryEditor(this, '${escapedOriginal}')">✏️ Edit & Retry</button>
                    </div>
                ` : `
                    <div class="message-text">${content.explanation || content.message || '✅ Great job! That sounds natural.'}</div>
                    <div class="message-actions">
                        <button class="retry-btn" onclick="showRetryEditor(this, '${escapedOriginal}')">✏️ Edit & Retry</button>
                    </div>
                `}
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showRetryEditor(btn, originalText) {
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

If there are improvements to make, provide TWO versions:
1. "formal" - polished, professional, confident leader tone
2. "natural" - conversational but improved, still sounds like them

Respond in JSON format:
{
    "original": "${text}",
    "formal": "formal/polished version, or null if already perfect",
    "natural": "natural but improved version, or null if already perfect",
    "explanation": "brief explanation of the key improvements",
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
                if (!result.isPerfect && (result.formal || result.natural)) {
                    saveMistake({ ...result, corrected: result.formal || result.natural });
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
        addMessageToChat('user', msg.user, msg.timestamp);
        addMessageToChat('ai', msg.ai, msg.timestamp);
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
    renderPhraseFixes();
    renderProgressStats();
    loadAICoachingTips();
}

function renderPhraseFixes(showAll = false) {
    const div = document.getElementById('phraseFixes');
    if (mistakes.length === 0) {
        div.innerHTML = '<p class="tips-placeholder">Start speaking — your phrase corrections will appear here.</p>';
        return;
    }
    const list = [...mistakes].reverse();
    const visible = showAll ? list : list.slice(0, 3);
    const cards = visible.map(m => `
        <div class="phrase-fix-card">
            <div class="phrase-wrong">❌ "${m.original}"</div>
            <div class="phrase-arrow">↓</div>
            <div class="phrase-right">✅ "${m.corrected}"</div>
            <div class="phrase-why">${m.explanation}</div>
        </div>
    `).join('');
    const toggle = list.length > 3 ? `
        <button class="show-more-btn" onclick="renderPhraseFixes(${!showAll})">
            ${showAll ? '▲ Show less' : `▼ Show ${list.length - 3} more`}
        </button>` : '';
    div.innerHTML = cards + toggle;
}
window.renderPhraseFixes = renderPhraseFixes;

function toggleSection(header) {
    const body = header.nextElementSibling;
    const chevron = header.querySelector('.section-chevron');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    chevron.textContent = isOpen ? '▶' : '▼';
}
window.toggleSection = toggleSection;

function renderProgressStats() {
    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('totalMistakes').textContent = mistakes.length;
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    document.getElementById('totalMessages').textContent = totalMessages;
}

function renderCachedTips(div, tips) {
    div.innerHTML = tips.map((t, i) => {
        const dateStr = t.generatedAt ? formatTimestamp(new Date(t.generatedAt)) : '';
        return `
        <div class="tip-card-thread" id="tip-${i}">
            <div class="tip-title">${t.title}${dateStr ? `<span class="tip-timestamp">${dateStr}</span>` : ''}</div>
            <div class="tip-content">${t.tip}</div>
            <div class="thread-comments" id="thread-comments-${i}"></div>
            <div class="thread-input-row">
                <input type="text" class="thread-input" placeholder="Ask a question about this tip..." onkeydown="if(event.key==='Enter') postThreadComment(${i}, '${escapeForAttr(t.title)}', '${escapeForAttr(t.tip)}')">
                <button class="thread-send-btn" onclick="postThreadComment(${i}, '${escapeForAttr(t.title)}', '${escapeForAttr(t.tip)}')">➤</button>
            </div>
        </div>
    `;}).join('');
}

async function loadAICoachingTips() {
    const div = document.getElementById('aiCoachingTips');
    if (mistakes.length === 0) {
        div.innerHTML = '<p class="tips-placeholder">Speak more to get personalized coaching tips.</p>';
        return;
    }

    // Load cache — only process mistakes that are new since last generation
    const cached = JSON.parse(localStorage.getItem('coachingTipsCache') || 'null');
    const existingTips = cached ? cached.tips : [];
    const processedCount = cached ? cached.mistakeCount : 0;

    if (processedCount === mistakes.length) {
        renderCachedTips(div, existingTips);
        return;
    }

    // Always show cached tips immediately, then add a loading card at the top for new ones
    renderCachedTips(div, existingTips);
    div.insertAdjacentHTML('afterbegin', '<div class="tip-card-thread" id="tipsLoadingMsg"><div class="tip-title">✨ Generating new tip...</div><div class="tip-content">Analyzing your latest mistakes...</div></div>');

    const newMistakes = mistakes.slice(processedCount);
    const mistakeSummary = newMistakes.map(m =>
        `Original: "${m.original}" → Better: "${m.corrected}" (${m.category})`
    ).join('\n');

    const prompt = `You are a professional English speaking coach. Based on these NEW mistakes a non-native speaker just made, give 1-3 short specific coaching tips. Each tip should be actionable and reference these actual mistakes. Do not repeat generic advice.

New mistakes:
${mistakeSummary}

Respond in JSON format:
{
  "tips": [
    { "title": "short title", "tip": "specific actionable advice" }
  ]
}`;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: getModel(),
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        const data = await response.json();
        console.log('Coaching tips full API response:', JSON.stringify(data));
        if (!data.content || !data.content[0]) {
            throw new Error(data.error?.message || data.type || 'No content in response');
        }
        const text = data.content[0].text;
        console.log('Coaching tips raw response:', text);
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON found in response');
        const json = JSON.parse(match[0]);
        const generatedAt = new Date().toISOString();
        const newTips = json.tips.map(t => ({ ...t, generatedAt }));
        const allTips = [...newTips, ...existingTips];
        localStorage.setItem('coachingTipsCache', JSON.stringify({
            mistakeCount: mistakes.length,
            tips: allTips
        }));
        renderCachedTips(div, allTips);
    } catch (e) {
        console.error('loadAICoachingTips error:', e);
        document.getElementById('tipsLoadingMsg')?.remove();
        if (existingTips.length === 0) {
            div.innerHTML = `<p class="tips-placeholder">Could not load coaching tips: ${e.message}</p>`;
        }
    }
}

// Store thread histories: { tipIndex: [{role, content}] }
const threadHistories = {};

function escapeForAttr(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

async function postThreadComment(tipIndex, tipTitle, tipContent) {
    const input = document.querySelector(`#tip-${tipIndex} .thread-input`);
    const userMsg = input.value.trim();
    if (!userMsg) return;
    input.value = '';

    const commentsDiv = document.getElementById(`thread-comments-${tipIndex}`);

    // Add user comment
    commentsDiv.innerHTML += `
        <div class="thread-comment thread-comment-user">
            <span class="thread-avatar">You</span>
            <div class="thread-bubble thread-bubble-user">${userMsg}</div>
        </div>`;
    commentsDiv.scrollTop = commentsDiv.scrollHeight;

    // Add loading bubble
    const loadingId = `loading-${tipIndex}-${Date.now()}`;
    commentsDiv.innerHTML += `
        <div class="thread-comment thread-comment-ai" id="${loadingId}">
            <span class="thread-avatar">AI</span>
            <div class="thread-bubble thread-bubble-ai">...</div>
        </div>`;
    commentsDiv.scrollTop = commentsDiv.scrollHeight;

    // Build thread history
    if (!threadHistories[tipIndex]) {
        threadHistories[tipIndex] = [{
            role: 'user',
            content: `You are a friendly English speaking coach. The user is discussing this coaching tip:

Title: "${tipTitle}"
Tip: "${tipContent}"

Answer their questions specifically about this tip. Be concise and practical.`
        }, {
            role: 'assistant',
            content: `Got it! I'm here to help you understand and apply this tip. What would you like to know?`
        }];
    }

    threadHistories[tipIndex].push({ role: 'user', content: userMsg });

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: getModel(),
                max_tokens: 512,
                messages: threadHistories[tipIndex]
            })
        });
        const data = await response.json();
        const aiReply = data.content[0].text.trim();
        threadHistories[tipIndex].push({ role: 'assistant', content: aiReply });

        document.getElementById(loadingId).querySelector('.thread-bubble').textContent = aiReply;
    } catch (e) {
        document.getElementById(loadingId).querySelector('.thread-bubble').textContent = 'Error — please try again.';
    }
    commentsDiv.scrollTop = commentsDiv.scrollHeight;
}

window.postThreadComment = postThreadComment;

function updateProgressStats() {
    renderProgressStats();
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
