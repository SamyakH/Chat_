# 🔐 Anon Chat - Decentralized P2P Encrypted Messaging

A fully end-to-end encrypted, decentralized desktop messaging application built with Electron, React, and TypeScript. Features secure peer-to-peer communication, WebRTC voice/video calling, and cryptographically verified contacts.

## ✨ Key Features

- **🔒 End-to-End Encryption**: ChaCha20-Poly1305 authenticated encryption on every message
- **🤝 Decentralized P2P**: Direct peer-to-peer messaging via WebRTC; signaling server only relays
- **📞 Voice & Video Calling**: WebRTC-based audio/video calls with encrypted signaling
- **🔑 Cryptographic Verification**: Ed25519 signatures and X25519 ECDH key exchange
- **📱 Contact Management**: Share identity via QR codes with fingerprint verification
- **💾 Local Storage**: All data stored locally on device; nothing sent to servers
- **🔥 Emergency Wipe**: One-click account deletion with secure data erasure
- **⚡ Offline Support**: Message queuing when signaling server unavailable
- **🎨 Modern UI**: Dark-themed interface built with React + Tailwind CSS
- **🔄 Cross-Platform**: Builds for Windows, macOS, and Linux

## 🏗️ Architecture

```
Renderer (React UI)
    ↓ IPC (Secure Bridge)
Preload (Context Bridge)
    ↓ IPC Handlers
Main Process (Node.js)
├── Core Modules
│   ├── Cryptography (Libsodium)
│   ├── Identity Management
│   ├── Storage (SQLite)
│   └── Networking (WebSocket P2P)
└── IPC Handlers
    ├── Identity
    ├── Contacts
    ├── Messages
    ├── Calling
    └── Account Management
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone repository and install dependencies
git clone <repo-url>
cd electron-app
npm install
```

### Development

```bash
# Start development server with live reload
npm run dev
```

### Building

```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux

# Build all platforms
npm run build
```

## 💻 Running Multiple Instances

Test P2P communication by running multiple instances with separate data directories:

```bash
# Terminal 1 - Instance 1 (User A)
npm start

# Terminal 2 - Instance 2 (User B)
npm start -- --user-data-dir=./temp/user2

# Terminal 3 - Instance 3 (User C)
npm start -- --user-data-dir=./temp/user3
```

Each instance maintains completely isolated local data, keys, and contacts.

## 🔐 Security Architecture

### Cryptographic Layers

| Operation | Algorithm | Details |
|-----------|-----------|---------|
| **Key Generation** | Ed25519 + X25519 | Signing and key exchange key pairs |
| **Message Encryption** | ChaCha20-Poly1305 | AEAD symmetric encryption |
| **Session Keys** | X25519 ECDH | Elliptic curve Diffie-Hellman |
| **Message Authentication** | Ed25519 Signatures | Detached signatures on ciphertext |
| **Passcode Hashing** | Scrypt | KDF with random salt |
| **Replay Prevention** | Nonce Tracking | Expiring nonce database |

### Message Encryption Flow

1. **Sender encrypts**:
   ```
   plaintext → ChaCha20-Poly1305(sessionKey, nonce) → ciphertext
   ciphertext || nonce → Ed25519.sign(privateKey) → signature
   
   Packet: {ciphertext, nonce, signature} (all Base64)
   ```

2. **Receiver decrypts**:
   ```
   Verify: Ed25519.verify(signature, ciphertext||nonce, publicKey)
   Decrypt: ChaCha20-Poly1305.open(ciphertext, nonce, sessionKey) → plaintext
   ```

3. **Session Key Derivation**:
   ```
   sessionKey = ECDH(myPrivateX25519, theirPublicX25519)
   ```

### Storage Security

- **Keys at Rest**: Stored encrypted in SQLite with file permissions (0o600)
- **Local Only**: No keys or messages ever sent to servers
- **Identity File**: JSON stored at `%APPDATA%/anon-chat/identity.json`
- **Database**: SQLite at `%APPDATA%/anon-chat/chat.db` with foreign key constraints
- **Emergency Wipe**: Securely delete entire application directory on demand

## 🎯 User Workflows

### Creating an Account

1. Launch app → Onboarding screen
2. Enter display name, status line, and passcode
3. Generate Ed25519 + X25519 key pairs
4. Hash passcode with scrypt
5. Store identity locally
6. Auto-unlock and show main interface

### Adding a Contact

**Via QR Code**:
1. Go to Share page
2. Friend scans your QR code (encodes publicId + displayName + public keys)
3. Friend goes to Scan Contact → points camera at QR code
4. Contact imported automatically

**Manually**:
1. Get contact's JSON payload from their Share page
2. Go to Add Contact → paste JSON payload
3. Verify fingerprint if desired
4. Contact added to your list

### Sending a Message

1. Select contact from sidebar
2. Type message in input field
3. Hit Enter or click Send
4. Message encrypted with contact's public key
5. Sent via P2P network (signaling server relays)
6. Receiver decrypts with your public key
7. Message displayed with delivery status

### Voice/Video Call

1. Click video/phone icon on contact
2. WebRTC offer sent via signaling server
3. Recipient sees call notification
4. Recipient accepts → answer sent
5. Direct P2P connection established
6. Media streams exchanged (audio/video)
7. Toggle microphone/camera during call
8. Click hang up to end

### Emergency Account Deletion

1. Go to Settings → Danger Zone
2. Click "Burn Account"
3. Type "DESTROY" to confirm
4. App deletes entire local data directory
5. Returns to onboarding (clean slate)

## 📁 Project Structure

```
src/
├── main/                          # Electron main process
│   ├── index.ts                   # App entry, window creation, IPC setup
│   ├── core/
│   │   ├── cryptography.ts        # Libsodium encryption/signing
│   │   ├── identity.ts            # Account creation/unlock/management
│   │   ├── storage.ts             # SQLite database operations
│   │   ├── networking.ts          # P2P WebSocket signaling
│   │   └── wipe.ts                # Emergency account deletion
│   └── ipc/
│       ├── identity.ipc.ts        # Identity IPC handlers
│       ├── contacts.ipc.ts        # Contact management IPC
│       ├── messages.ipc.ts        # Messaging IPC
│       ├── calls.ipc.ts           # WebRTC calling IPC
│       ├── workspace.ipc.ts       # Workspace/session IPC
│       └── wipe.ipc.ts            # Wipe account IPC
├── preload/                       # Preload script
│   ├── index.ts                   # Secure API bridge
│   └── index.d.ts                 # Type definitions
├── renderer/                      # React UI
│   ├── index.html                 # HTML entry point
│   └── src/
│       ├── App.tsx                # Main app routing & state
│       ├── main.tsx               # React entry point
│       ├── assets/                # CSS and static files
│       ├── components/
│       │   ├── AppLayout.tsx       # Layout wrapper
│       │   ├── MessageBubble.tsx   # Message display
│       │   ├── ContactCard.tsx     # Contact item
│       │   ├── CallWindow.tsx      # WebRTC call UI
│       │   ├── EncryptionBadge.tsx # E2E indicator
│       │   └── QRDisplay.tsx       # QR code display
│       ├── core/
│       │   └── webrtc-manager.ts   # WebRTC manager singleton
│       └── pages/
│           ├── LoginPage.tsx       # Authentication
│           ├── OnboardingPage.tsx  # Account creation
│           ├── ChatPage.tsx        # Main messaging
│           ├── ContactsPage.tsx    # Contact management
│           ├── AddContactPage.tsx  # Add contact form
│           ├── ScanContactPage.tsx # QR scanning
│           ├── SharePage.tsx       # Share identity
│           └── SettingsPage.tsx    # User settings
└── shared/
    └── api.ts                     # Shared type definitions
```

## 🗄️ Database Schema

### Key Tables

```sql
-- Contacts
contacts (
  id, display_name, fingerprint (UNIQUE), 
  ed_public_key, x_public_key, public_id,
  note, is_blocked, created_at, last_message_at
)

-- Messages
messages (
  id, conversation_id, contact_id,
  direction ('incoming'|'outgoing'),
  plaintext, ciphertext, nonce, signature,
  delivery_status ('sent'|'delivered'|'failed'),
  is_edited, is_deleted, created_at
)

-- Identity Keys
identity_keys (
  key_type ('signing'|'exchange'),
  public_key, private_key, created_at
)

-- Contact Requests
contact_requests (
  id, remote_public_id (UNIQUE),
  display_name, ed_public_key, x_public_key,
  direction ('incoming'|'outgoing'),
  status ('pending'|'accepted'|'declined'),
  created_at, updated_at
)
```

## 🛠️ Technology Stack

### Frontend
- **Electron 39.2.6** - Desktop application framework
- **React 19** - UI framework
- **React Router v7** - Navigation
- **Tailwind CSS 4** - Styling
- **Lucide React** - Icon library
- **html5-qrcode** - QR code scanner
- **qrcode.react** - QR code generator
- **TypeScript** - Type safety

### Backend (Main Process)
- **Node.js** - JavaScript runtime (via Electron)
- **better-sqlite3** - Synchronous SQLite database
- **libsodium-wrappers** - Cryptography (NaCl library)
- **ws** - WebSocket client
- **Zod** - Runtime validation

### Development Tools
- **Vite** - Build tool
- **electron-vite** - Electron + Vite integration
- **electron-builder** - App packaging
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking

## 🧪 Testing

### Local Testing with Multiple Instances

Create test directories and run separate instances:

```bash
# Create test directories
mkdir -p temp/user1 temp/user2 temp/user3

# Terminal 1
npm start -- --user-data-dir=./temp/user1

# Terminal 2
npm start -- --user-data-dir=./temp/user2

# Terminal 3
npm start -- --user-data-dir=./temp/user3
```

### Test Scenarios

1. **Account Creation**: Create accounts in each instance with unique display names
2. **Contact Exchange**: Use QR codes to add contacts between instances
3. **Messaging**: Send messages between instances, verify encryption
4. **Call Setup**: Initiate calls between instances (requires signaling server)
5. **Message Editing**: Edit/delete messages, verify updates
6. **Emergency Wipe**: Test account deletion in one instance

## 🔧 Development

### Recommended IDE Setup

- **[VSCode](https://code.visualstudio.com/)** with extensions:
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Scripts

```bash
npm run dev              # Development server
npm run build            # Build for current platform
npm run build:win        # Build for Windows
npm run build:mac        # Build for macOS
npm run build:linux      # Build for Linux
npm run typecheck        # Type check code
npm run lint             # Lint code
npm run format           # Format code
npm start                # Preview build
```

## 📝 Configuration Files

- **electron.vite.config.ts** - Electron + Vite configuration
- **tsconfig.json** - TypeScript configuration
- **electron-builder.yml** - App packaging configuration
- **eslint.config.mjs** - ESLint rules
- **.prettierrc** - Code formatting rules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Run `npm run typecheck && npm run lint`
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙋 Support

For issues, feature requests, or documentation questions, please open an issue on the repository.

## 🔐 Security Note

This application is designed with security as a first-class citizen:

- **No Telemetry**: No data collection or analytics
- **No Cloud Sync**: All data stays on your device
- **Open Source**: Code is available for security audits
- **Encryption Verified**: Uses well-tested libsodium library
- **Local Validation**: All crypto operations happen locally

For security concerns, please contact the maintainers directly.