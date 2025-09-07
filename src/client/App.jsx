import React, { useState, useRef } from 'react';
import { TextEditor } from './components/TextEditor';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
    const [users, setUsers] = useState(0);
    const editorRef = useRef(null);

    const handleEditorOperation = (operation) => {
        send({ type: 'operation', operation });
    };

    const handleWebSocketMessage = (data) => {
        switch (data.type) {
            case 'operation':
                if (editorRef.current) {
                    editorRef.current.applyRemoteOperation(data.operation);
                }
                break;
            case 'users_update':
                setUsers(data.count);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    };

    const { send } = useWebSocket(
        process.env.NODE_ENV === 'production'
            ? 'wss://your-vercel-app.vercel.app'
            : 'ws://localhost:3001',
        handleWebSocketMessage
    );

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Collaborative Text Editor</h1>
            <p>Active users: {users}</p>

            <TextEditor
                ref={editorRef}
                onOperation={handleEditorOperation}
                initialContent=""
            />

            <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
                <p>Try opening this page in multiple browser tabs to see real-time collaboration!</p>
            </div>
        </div>
    );
}
