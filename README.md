# Socket Browser

🚀 **Next-generation browser that generates UI from Socket Agent APIs using LLMs.**

Instead of serving static HTML/CSS, Socket Browser discovers Socket Agent APIs and uses AI to generate appropriate user interfaces on-the-fly. Built with Tauri and Rust for maximum performance and minimal resource usage.

## Features

- 🔍 **Auto-Discovery**: Automatically discovers Socket Agent APIs via `.well-known/socket-agent`
- 🤖 **AI UI Generation**: Uses LLMs to generate contextual interfaces through render service
- 💰 **Built-in Wallet**: Solana wallet with BIP-39 support for micropayments
- 🔐 **Authentication**: Integrated with socketagent.id for user accounts and credits
- ⚡ **Fast & Light**: Native performance with small bundle size (10-50MB)
- 🦀 **Rust Backend**: Type-safe, memory-safe backend with Tauri
- 🎨 **Adaptive Design**: UI adapts to the purpose of each API

## Quick Start

### Prerequisites

- **Rust** 1.90+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Node.js** 16+ (for frontend dependencies)
- **System dependencies** (Linux):
  ```bash
  # Ubuntu/Debian
  sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd socketbrowser
   npm install
   ```

2. **Run in development mode**:
   ```bash
   npm run tauri:dev
   ```

3. **Build for production**:
   ```bash
   npm run tauri:build
   ```

### Testing with APIs

1. **Start socketagent.id** (authentication service):
   ```bash
   cd ../socketagent.id
   ./socketagent-id
   # Runs on http://localhost:8080
   ```

2. **Start socketbrowser-api** (render service):
   ```bash
   cd ../socketbrowser-api
   ./api
   # Runs on http://localhost:8000
   ```

3. **Try a Socket Agent API**:
   - Enter any Socket Agent API URL in the address bar
   - Sign in with socketagent.id to generate UIs
   - The browser will discover and generate an interface

## How it Works

1. **Discovery**: Browser fetches `/.well-known/socket-agent` descriptor from the API
2. **Authentication**: User signs in via socketagent.id for render credits
3. **Generation**: Render service uses LLM to create contextual HTML interface
4. **Interaction**: Generated UI elements make real API calls transparently
5. **Display**: Results shown in real-time with adaptive layouts

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (ui/)                                              │
│  HTML/CSS/JS with ES6 modules                                │
└────────────────────┬─────────────────────────────────────────┘
                     │ Tauri invoke()
┌────────────────────▼─────────────────────────────────────────┐
│  Rust Backend (src-tauri/src/)                               │
│  • Wallet (Solana, AES-256-GCM, BIP-39)                      │
│  • Storage (Thread-safe JSON)                                │
│  • API Discovery & Client                                    │
│  • Auth Client (socketagent.id)                              │
│  • Render Client (socketbrowser-api)                         │
└────┬──────────────────┬──────────────────┬───────────────────┘
     │                  │                  │
     │                  │                  │
┌────▼────────┐  ┌─────▼─────────┐  ┌────▼──────────────┐
│ Socket      │  │ socketagent.id │  │ socketbrowser-api │
│ Agent APIs  │  │ (Auth Service) │  │ (Render Service)  │
└─────────────┘  └────────────────┘  └───────────────────┘
```

## Technology Stack

- **Backend**: Rust (Tauri 2.0, Tokio, Reqwest)
- **Wallet**: Solana SDK, AES-256-GCM, PBKDF2, BIP-39
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Auth**: socketagent.id (JWT-style tokens)
- **Render**: socketbrowser-api (LLM proxy service)

## Development

### Project Structure

```
socketbrowser/
├── ui/                      # Frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── main.js          # App entry
│       ├── tauri-api.js     # Rust command wrappers
│       ├── wallet-ui.js     # Wallet interface
│       └── auth-ui.js       # Auth interface
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri app
│   │   ├── wallet/         # Solana wallet
│   │   ├── storage/        # Persistent storage
│   │   ├── api/            # API discovery & client
│   │   ├── auth/           # socketagent.id client
│   │   └── llm/            # Render API client
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

### Available Scripts

```bash
# Development with hot reload
npm run tauri:dev

# Build optimized binary
npm run tauri:build

# Check Rust code
cd src-tauri && cargo check

# Run Rust tests
cd src-tauri && cargo test
```

## Wallet

Socket Browser includes a built-in Solana wallet:

- **Generation**: Create new wallet with 12-word recovery phrase
- **Import**: From mnemonic or private key (base58)
- **Security**: AES-256-GCM encryption with PBKDF2 (100k iterations)
- **Features**: Balance queries, transaction signing
- **Network**: Solana mainnet-beta

Access wallet via the 💰 button in the top-right corner.

## Authentication

Sign in with socketagent.id to generate UIs:

1. Click the 👤 button in the top-right
2. Create an account or sign in
3. Tokens are stored locally and refreshed automatically
4. Each UI generation consumes 1 render credit

## Configuration

The browser connects to these services by default:

- **socketagent.id**: `https://socketagent.io` (authentication)
- **socketbrowser-api**: `http://localhost:8000` (render service)

To change these, edit the Rust source:
- Auth URL: `src-tauri/src/auth/mod.rs`
- Render URL: `src-tauri/src/llm/mod.rs`

## Performance

Compared to the previous Electron version:

| Metric        | Electron | Tauri  | Improvement |
|---------------|----------|--------|-------------|
| Bundle Size   | 150-300MB| 10-50MB| 90% smaller |
| Memory Usage  | ~200MB   | ~60MB  | 70% less    |
| Startup Time  | 2-3 sec  | <1 sec | 3x faster   |
| Backend       | Node.js  | Rust   | Type-safe   |

## The Vision

Socket Browser demonstrates the future of web interaction:

- APIs describe their capabilities in machine-readable formats
- Browsers intelligently generate appropriate interfaces
- No more static HTML - everything is dynamic and contextual
- Universal accessibility through AI-generated UIs
- Decentralized, open protocols for API discovery

## License

BSD-3-Clause License - see LICENSE file for details.

Copyright (c) 2025 socketagent
