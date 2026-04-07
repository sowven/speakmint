# 🎓 English Teacher AI - Voice-Powered Language Learning App

An AI-powered Progressive Web App that helps you improve your English through voice conversations. Get real-time corrections, track your mistakes, and receive personalized learning tips!

## ✨ Features

### 💬 Voice Chat
- **Speak naturally** - Just tap the mic and speak in English
- **Real-time transcription** - See what you said instantly
- **AI corrections** - Get immediate feedback from Claude AI
- **Voice responses** - Hear the correct pronunciation
- **Multiple sessions** - Organize conversations by topic

### 📝 Mistakes Review
- **Comprehensive table** - All your mistakes in one place
- **Search & filter** - Find specific mistakes by category
- **Export to CSV** - Download your learning history
- **Categories**: Grammar, Vocabulary, Style, Pronunciation

### 💡 Learning Tips
- **Proficiency levels** - Beginner, Intermediate, Advanced
- **Common mistakes** - See your most frequent errors
- **Grammar tips** - Level-appropriate grammar lessons
- **Vocabulary suggestions** - Expand your word knowledge
- **Progress tracking** - Monitor your improvement

## 🚀 Quick Start

### Prerequisites
- **Anthropic API Key** - Get one from https://console.anthropic.com/
- **Modern browser** - Chrome recommended (for best voice recognition)
- **Microphone** - For voice input

### Installation

#### Option 1: Run Locally (Recommended for Testing)

1. **Start a local server:**
   ```bash
   cd /home/sowmyasb/Downloads/english-teacher-app
   python3 -m http.server 8080
   ```

2. **Open in browser:**
   - Desktop: `http://localhost:8080`
   - Phone: `http://YOUR_IP:8080` (find IP with `hostname -I`)

3. **Enter API Key:**
   - On first launch, you'll be prompted for your Anthropic API key
   - It's saved securely in your browser's local storage

#### Option 2: Install as Android App (PWA)

1. **Access from phone:**
   - Make sure phone and computer are on same WiFi
   - Open Chrome on your phone
   - Go to `http://YOUR_COMPUTER_IP:8080`

2. **Install the app:**
   - Tap the menu (⋮) in Chrome
   - Select "Install app" or "Add to Home Screen"
   - App icon appears on your home screen!

3. **Use like a native app:**
   - Tap icon to open
   - Grant microphone permission
   - Start speaking!

#### Option 3: Deploy Online (Access Anywhere)

**Using GitHub Pages:**
```bash
# Create a new repository on GitHub
# Upload all files from english-teacher-app/
# Enable GitHub Pages in repository settings
# Access at: https://yourusername.github.io/repo-name
```

**Using Netlify:**
1. Go to https://netlify.com
2. Drag the `english-teacher-app` folder
3. Get instant URL: `https://your-app.netlify.app`

## 📱 How to Use

### Chat Tab
1. **Tap the microphone button** 🎤
2. **Speak your sentence** in English
3. **Wait for AI analysis** (2-3 seconds)
4. **Review the correction** if any mistakes found
5. **Listen to proper pronunciation** 🔊
6. **Continue the conversation**

### Managing Sessions
- **View sessions**: Tap "📚 Today's Practice" button
- **Create new**: Tap "+ New" button
- **Switch sessions**: Tap any session in the sidebar
- **Delete sessions**: Tap the × button (can't delete last session)

### Mistakes Tab
- **View all mistakes**: Automatically populated as you chat
- **Search**: Type keywords to find specific mistakes
- **Filter**: Select category (Grammar, Vocabulary, etc.)
- **Export**: Download CSV file of all mistakes
- **Delete**: Remove individual mistake records

### Tips Tab
- **Select your level**: Beginner, Intermediate, or Advanced
- **View common mistakes**: See your most frequent error types
- **Read grammar tips**: Level-appropriate lessons
- **Learn vocabulary**: Suggested words for your level
- **Track progress**: See total sessions, mistakes, and messages

## 🔧 Technical Details

### Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **AI**: Anthropic Claude 3.5 Sonnet API
- **Voice**: Web Speech API (recognition) + Speech Synthesis API
- **Storage**: LocalStorage for sessions and mistakes
- **PWA**: Service Worker for offline capability

### Browser Compatibility
- ✅ **Chrome/Edge** (Recommended) - Full support
- ✅ **Safari** - Works, but voice recognition may vary
- ⚠️ **Firefox** - Limited voice recognition support
- ❌ **Opera** - Not recommended

### Data Storage
- **Local only** - All data stored in browser's LocalStorage
- **No cloud sync** - Data stays on your device
- **Privacy first** - No tracking or analytics
- **API calls** - Only to Anthropic for AI corrections

### API Usage & Costs
- **Model**: Claude 3.5 Sonnet
- **Cost**: ~$0.003 per message (very affordable)
- **Example**: 100 messages = ~$0.30
- **Your API key** - You control usage and costs

## 🎯 Use Cases

### For Students
- Practice speaking before exams
- Improve pronunciation
- Learn from mistakes
- Build confidence

### For Professionals
- Prepare for presentations
- Improve business English
- Practice interviews
- Enhance communication skills

### For Language Learners
- Daily practice routine
- Track progress over time
- Identify weak areas
- Get personalized tips

## 🔒 Privacy & Security

- ✅ **No data collection** - We don't collect any data
- ✅ **Local storage** - Everything stays on your device
- ✅ **API key security** - Stored locally in browser
- ✅ **No tracking** - No analytics or cookies
- ✅ **Open source** - Review the code yourself

## 🐛 Troubleshooting

### Microphone not working
- **Check permissions**: Allow microphone access in browser
- **Check hardware**: Test mic in other apps
- **Try Chrome**: Best voice recognition support

### API errors
- **Check API key**: Make sure it's valid and active
- **Check credits**: Ensure you have API credits
- **Check internet**: API requires internet connection

### Voice recognition issues
- **Speak clearly**: Enunciate words
- **Reduce noise**: Find quiet environment
- **Use Chrome**: Best browser for voice recognition
- **Check language**: Set to English (US)

### App not installing on phone
- **Use Chrome**: Other browsers may not support PWA install
- **Check HTTPS**: Some features require secure connection
- **Try "Add to Home Screen"**: Manual installation option

## 📊 Features Roadmap

Future enhancements (not yet implemented):
- [ ] Cloud sync across devices
- [ ] Conversation topics/scenarios
- [ ] Pronunciation scoring
- [ ] Vocabulary flashcards
- [ ] Achievement badges
- [ ] Social sharing
- [ ] Multiple language support

## 🤝 Contributing

This is a personal learning tool, but feel free to:
- Fork and customize for your needs
- Report bugs or issues
- Suggest new features
- Share improvements

## 📄 License

Free to use and modify for personal and educational purposes.

## 🙏 Acknowledgments

- **Anthropic** - For the amazing Claude AI
- **Web Speech API** - For voice recognition
- **You** - For improving your English!

---

## 💬 Quick Tips

1. **Practice daily** - Even 5 minutes helps
2. **Review mistakes** - Learn from corrections
3. **Use sessions** - Organize by topic
4. **Export data** - Keep records of progress
5. **Adjust level** - Match tips to your proficiency

**Happy Learning! 🎓📚**
