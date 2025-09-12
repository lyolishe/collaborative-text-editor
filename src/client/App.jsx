import React, { useState, useRef, useCallback } from 'react';
import { TextEditor } from './components/TextEditor';
import { useWebSocket } from './hooks/useWebSocket';

/**
 * Main application component for the collaborative text editor.
 * Manages WebSocket connection and coordinates between the editor and server.
 */
function App() {
    const [userCount, setUserCount] = useState(0);
    const editorRef = useRef(null);

    /**
     * Handle incoming WebSocket messages from the server.
     */
    const handleWebSocketMessage = useCallback((data) => {
        switch (data.type) {
            case 'operation':
                // Apply remote text operations to the editor
                if (editorRef.current && typeof editorRef.current.applyRemoteOperation === 'function') {
                    editorRef.current.applyRemoteOperation(data.operation);
                }
                break;
            case 'users_update':
                // Update active user count
                setUserCount(data.count);
                break;
            default:
                console.warn('Unknown WebSocket message type:', data.type);
        }
    }, []);

    // WebSocket URL configuration
    const isDevelopment = import.meta.env?.MODE !== 'production';
    const wsUrl = isDevelopment ? 'ws://localhost:3001' : 'wss://your-vercel-app.vercel.app';

    // Initialize WebSocket connection
    const { send, connectionState, reconnect } = useWebSocket(wsUrl, handleWebSocketMessage);

    /**
     * Handle local editor operations and broadcast them to other clients.
     */
    const handleEditorOperation = useCallback((operation) => {
        send({ type: 'operation', operation });
    }, [send]);

    const getConnectionStatusStyle = () => {
        const baseStyle = {
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'inline-block',
            marginLeft: '10px'
        };
        
        switch (connectionState) {
            case 'CONNECTED':
                return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
            case 'CONNECTING':
                return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
            case 'RECONNECTING':
                return { ...baseStyle, backgroundColor: '#f8d7da', color: '#721c24' };
            case 'DISCONNECTED':
                return { ...baseStyle, backgroundColor: '#f8d7da', color: '#721c24' };
            default:
                return baseStyle;
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '20px' }}>
                <h1 style={{ margin: '0 0 10px 0' }}>Collaborative Text Editor</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>Active users: {userCount}</span>
                    <span style={getConnectionStatusStyle()}>
                        {connectionState.toLowerCase()}
                    </span>
                    {connectionState === 'DISCONNECTED' && (
                        <button 
                            onClick={reconnect} 
                            style={{ 
                                padding: '4px 8px', 
                                fontSize: '12px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Reconnect
                        </button>
                    )}
                </div>
            </header>

            <TextEditor
                ref={editorRef}
                onOperation={handleEditorOperation}
                initialContent=""
            />

            <footer style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
                <p>💡 Tip: Open this page in multiple browser tabs or share the URL to see real-time collaboration!</p>
            </footer>
        </div>
    );
}

export default App;
