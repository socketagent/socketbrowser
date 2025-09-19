# Socket Browser

🚀 **The next-generation browser that generates UI from Socket Agent APIs using LLMs.**

Instead of serving static HTML/CSS, Socket Browser discovers Socket Agent APIs and uses AI to generate appropriate user interfaces on-the-fly.

## Features

- 🔍 **Auto-Discovery**: Automatically discovers Socket Agent APIs via `.well-known/socket-agent`
- 🤖 **AI UI Generation**: Uses LLMs (OpenAI GPT-4) to generate contextual interfaces
- ⚡ **Real-time Interaction**: Generated UIs make actual API calls and display results
- 🎨 **Adaptive Design**: UI adapts to the purpose of each API (grocery store, bank, etc.)
- 🛠 **Developer Tools**: Built-in debug panel (Ctrl+D) to monitor API interactions

## Quick Start

1. **Clone and Install**:
   ```bash
   git clone <repo-url>
   cd socket-browser
   npm install
   ```

2. **Set up OpenAI API Key**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start Test APIs** (in separate terminals):
   ```bash
   # Terminal 1 - Grocery API
   cd /path/to/socketagentpy/examples/benchmark/grocery_api
   python main.py

   # Terminal 2 - Banking API
   cd /path/to/socketagentpy/examples/benchmark/banking_api
   python main.py
   ```

4. **Run Socket Browser**:
   ```bash
   npm start
   ```

5. **Try it out**:
   - Enter `http://localhost:8001` in the address bar
   - Watch as the browser generates a grocery store interface
   - Try `http://localhost:8003` for a banking interface

## How it Works

1. **Discovery**: Browser fetches `/.well-known/socket-agent` descriptor
2. **Analysis**: LLM analyzes the API capabilities and purpose
3. **Generation**: AI generates appropriate HTML forms and interfaces
4. **Interaction**: Generated UI elements make real API calls
5. **Display**: Results are shown in real-time

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron UI   │◄──►│ Socket Agent    │◄──►│ LLM UI Gen      │
│   (Browser)     │    │ Discovery       │    │ (OpenAI)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  ▼
                        ┌─────────────────┐
                        │ Socket Agent    │
                        │ APIs            │
                        └─────────────────┘
```

## Example APIs

The browser has been tested with these Socket Agent APIs:

- **Grocery Store** (`localhost:8001`): Product search, cart management
- **Banking** (`localhost:8003`): Account management, transactions
- **Recipe Service** (`localhost:8002`): Recipe search and management
- **E-commerce** (`localhost:8004`): Product catalog, orders

## Development

```bash
# Development mode (with DevTools)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Configuration

Create a `.env` file with:

```env
OPENAI_API_KEY=your-api-key-here
```

## Debug Mode

Press `Ctrl+D` to toggle the debug panel and see:
- API discovery logs
- UI generation requests
- Real-time API calls and responses

## The Vision

This demonstrates the future of web browsing:
- APIs describe their capabilities in machine-readable formats
- Browsers intelligently generate appropriate interfaces
- No more static HTML - everything is dynamic and contextual
- Universal accessibility through AI-generated UIs

## License

MIT License - see LICENSE file for details.