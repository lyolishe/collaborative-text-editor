# Collaborative Text Editor

A real-time collaborative text editor built with React and WebSockets, featuring a custom CRDT (Conflict-free Replicated Data Type) implementation for seamless concurrent editing.

## Features

- **Real-time collaboration**: Multiple users can edit simultaneously
- **CRDT-based conflict resolution**: Automatic handling of concurrent edits
- **WebSocket communication**: Low-latency real-time updates
- **Auto-reconnection**: Automatic reconnection on connection loss
- **User tracking**: Live count of active users

## Architecture

- **Frontend**: React with Vite (Port 3000)
- **Backend**: Node.js with Express and WebSockets (Port 3001)
- **Algorithm**: Custom CRDT with position-based identifiers and Lamport timestamps

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Setup and Installation

### 1. Install Dependencies

**Backend dependencies:**
```powershell
cd src/server
npm install
```

**Frontend dependencies:**
```powershell
cd src/client
npm install
```

### 2. Running the Application

**Start the backend server (Port 3001):**
```powershell
cd src/server
npm start
```

**In a new terminal, start the frontend (Port 3000):**
```powershell
cd src/client
npm run dev
```

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

To test collaboration, open the same URL in multiple browser tabs or different browsers.

## Development Scripts

### Frontend (src/client)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend (src/server)
- `npm start` - Start the WebSocket server
- `npm run dev` - Start the server (same as start)

## Project Structure

```
src/
├── client/                 # React frontend
│   ├── components/         # React components
│   │   └── TextEditor.jsx # Main text editor component
│   ├── hooks/             # Custom React hooks
│   │   └── useWebSocket.js # WebSocket connection hook
│   ├── utils/             # Utilities
│   │   └── CRDTTextEditor.js # CRDT implementation
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # App entry point
│   ├── index.html        # HTML template
│   └── package.json      # Frontend dependencies
└── server/                # Node.js backend
    ├── index.js          # WebSocket server
    └── package.json      # Backend dependencies
```

## How It Works

1. **Client Connection**: Each client connects to the WebSocket server and receives a unique site ID
2. **Text Operations**: When a user types, the CRDT algorithm generates operations with unique position identifiers
3. **Broadcasting**: Operations are sent to the server and broadcast to all connected clients
4. **Operation Application**: Remote operations are applied to each client's local CRDT state
5. **Conflict Resolution**: The CRDT ensures all clients converge to the same document state

## CRDT Implementation

The editor uses a custom CRDT with:
- **Position-based IDs**: Fractional indexing for character positioning
- **Lamport Timestamps**: For operation ordering
- **Site IDs**: Unique client identification
- **Tombstone Deletion**: Preserves deleted characters for consistency

## License

MIT License
