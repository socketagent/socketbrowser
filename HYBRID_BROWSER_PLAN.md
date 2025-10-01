# Hybrid Browser Architecture Plan

## Vision: Support BOTH Traditional HTML + Socket Agent APIs

### Current State
- ✅ Socket Agent discovery
- ✅ LLM-generated UI
- ❌ Cannot view regular HTML websites

### Target State
- ✅ Socket Agent APIs → Generate UI with LLM
- ✅ Traditional HTML → Render like Chrome
- ✅ Smart detection (try Socket Agent first, fallback to HTML)
- ✅ Mixed navigation (HTML site → Socket Agent API → back to HTML)

---

## Architecture Options

### **Option 1: BrowserView (Recommended)** ⭐

Use Electron's `BrowserView` to embed Chromium rendering:

```javascript
const { BrowserView } = require('electron');

// Socket Agent mode: Use current LLM generation
const socketAgentView = /* current generatedUI div */;

// Traditional HTML mode: Use BrowserView
const htmlView = new BrowserView({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true
  }
});

// Switch based on detection
if (isSocketAgent(url)) {
  showSocketAgentView();
} else {
  htmlView.webContents.loadURL(url);
  showHtmlView();
}
```

**Pros:**
- ✅ Full Chrome rendering engine
- ✅ Handles JavaScript, CSS, images, everything
- ✅ Can intercept requests (detect Socket Agent APIs)
- ✅ Security sandbox built-in

**Cons:**
- ⚠️ More complex navigation handling
- ⚠️ Need to manage two rendering systems

---

### **Option 2: WebView Tag**

Use `<webview>` tag in renderer:

```html
<webview id="html-renderer" src="about:blank"></webview>
<div id="socket-agent-renderer"></div>
```

**Pros:**
- ✅ Simpler integration
- ✅ Easier to style

**Cons:**
- ❌ Less secure
- ❌ Deprecated by Electron (may be removed)

---

### **Option 3: iframe (Simplest)**

Embed websites in iframe:

```html
<iframe id="html-renderer" sandbox="allow-scripts allow-same-origin"></iframe>
```

**Pros:**
- ✅ Very simple
- ✅ Works immediately

**Cons:**
- ❌ Many sites block iframes (X-Frame-Options)
- ❌ Limited control
- ❌ Can't intercept deep navigation

---

## Recommended Implementation: **BrowserView**

### Step 1: Detection Logic

```javascript
async function handleNavigation(url) {
  // Try Socket Agent first
  const socketAgentCheck = await fetch(`${url}/.well-known/socket-agent`);

  if (socketAgentCheck.ok) {
    // Socket Agent API - use LLM generation
    await renderSocketAgent(url);
  } else {
    // Traditional HTML - use BrowserView
    await renderTraditionalHTML(url);
  }
}
```

### Step 2: Dual Rendering System

```javascript
class HybridRenderer {
  constructor() {
    this.mode = null; // 'socket-agent' or 'html'
    this.browserView = null;
    this.socketAgentDiv = document.getElementById('generated-ui');
  }

  async render(url) {
    const mode = await detectMode(url);

    if (mode === 'socket-agent') {
      this.switchToSocketAgent();
      await this.renderSocketAgent(url);
    } else {
      this.switchToHTML();
      await this.renderHTML(url);
    }
  }

  switchToSocketAgent() {
    if (this.browserView) {
      this.browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // Hide
    }
    this.socketAgentDiv.classList.remove('hidden');
    this.mode = 'socket-agent';
  }

  switchToHTML() {
    this.socketAgentDiv.classList.add('hidden');
    if (!this.browserView) {
      this.browserView = new BrowserView();
      mainWindow.addBrowserView(this.browserView);
    }
    // Position BrowserView to fill content area
    this.browserView.setBounds({ x: 0, y: 70, width: 1200, height: 800 });
    this.mode = 'html';
  }
}
```

### Step 3: Navigation Interception

```javascript
// Intercept all navigation in BrowserView
browserView.webContents.on('will-navigate', async (event, url) => {
  event.preventDefault();

  // Check if this is a Socket Agent API
  await hybridRenderer.render(url);
});

// Also intercept link clicks in Socket Agent generated HTML
generatedUI.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    e.preventDefault();
    hybridRenderer.render(e.target.href);
  }
});
```

---

## Features This Enables

### 1. **Universal Browsing**
- Browse normal websites (Google, GitHub, etc.)
- When you hit a Socket Agent API, auto-switch to generated UI
- Seamless back/forward between modes

### 2. **Smart Detection**
- Try `/.well-known/socket-agent` first
- If 404, assume traditional HTML
- Cache detection results

### 3. **Mixed Navigation**
```
User flow:
1. Browse Google.com (HTML mode)
2. Click link to Socket Agent grocery store
3. Browser switches to generated UI mode
4. User clicks "back"
5. Returns to Google (HTML mode)
```

### 4. **Developer Tools**
- Show DevTools for HTML sites
- Show API inspector for Socket Agent sites
- Visual indicator of current mode

---

## Implementation Phases

### Phase 1: Basic HTML Support (2-3 days)
- [ ] Add BrowserView to main window
- [ ] Implement mode detection
- [ ] Basic URL rendering
- [ ] Switch between views

### Phase 2: Smart Navigation (3-4 days)
- [ ] Intercept navigation events
- [ ] Unified history (HTML + Socket Agent)
- [ ] Back/forward across modes
- [ ] Refresh handling

### Phase 3: Polish (2-3 days)
- [ ] Loading indicators for both modes
- [ ] Error handling for HTML sites
- [ ] DevTools integration
- [ ] Mode indicator in UI

### Phase 4: Advanced Features (ongoing)
- [ ] Bookmark both types of sites
- [ ] Search both HTML and Socket Agent APIs
- [ ] Tabs (multiple HTML/Socket Agent sites)
- [ ] Extensions/plugins

---

## Comparison to Other AI Browsers

### **Arc Browser**
- Uses Chromium + AI sidebar
- AI is separate from rendering
- **We're different:** AI generates the UI itself for Socket Agent APIs

### **Browser Company's Arc**
- AI summarizes pages
- AI helps navigate
- **We're different:** We create entirely new interfaces from APIs

### **Perplexity Browser Extension**
- AI answers questions about pages
- **We're different:** We generate navigable websites

### **Our Unique Value:**
1. **Dual-mode:** Handle both HTML and APIs
2. **AI-native for APIs:** Don't just render JSON, create UIs
3. **LLM choice:** Toggle OpenAI/Ollama
4. **Open protocol:** Anyone can add Socket Agent to their API

---

## Technical Challenges

### Challenge 1: CORS & Security
**Problem:** BrowserView and generated HTML have different security contexts

**Solution:**
- Use Electron's session API
- Proxy all requests through main process
- Consistent security policy

### Challenge 2: History Management
**Problem:** Mixing HTML history with Socket Agent navigation

**Solution:**
```javascript
class UnifiedHistory {
  entries = [
    { url: 'google.com', mode: 'html', state: null },
    { url: 'localhost:8001', mode: 'socket-agent', state: {...} },
    { url: 'github.com', mode: 'html', state: null }
  ];
}
```

### Challenge 3: Resource Usage
**Problem:** Running both Chromium AND LLM generation

**Solution:**
- Only initialize BrowserView when needed
- Unload unused views
- Limit LLM calls with caching

---

## Code Structure

```
socketbrowser/
├── src/
│   ├── main.js                    # Electron main process
│   ├── renderer/
│   │   ├── hybrid-renderer.js     # NEW: Manages both modes
│   │   ├── socket-agent-renderer.js  # Current LLM generation
│   │   ├── html-renderer.js       # NEW: BrowserView management
│   │   └── renderer.js            # Main renderer logic
│   ├── python/
│   │   └── bridge.py              # LLM generation (unchanged)
│   └── detection/
│       └── socket-agent-detector.js  # NEW: Auto-detection
```

---

## Next Steps

1. **Prototype BrowserView integration** (1-2 hours)
2. **Test with real websites** (1 hour)
3. **Implement detection logic** (2-3 hours)
4. **Build unified navigation** (4-6 hours)

**Total:** ~1-2 days for basic hybrid browser

Want me to start implementing this?
