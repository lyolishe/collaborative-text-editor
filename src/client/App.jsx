import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TextEditor } from './components/TextEditor';
import { useWebSocket } from './hooks/useWebSocket';
import { useOffline } from './hooks/useOffline';
import { OfflineQueue } from './utils/OfflineQueue';

/**
 * Main application component for the collaborative text editor.
 * Manages WebSocket connection and coordinates between the editor and server.
 */
function App() {
    const [userCount, setUserCount] = useState(0);
    const editorRef = useRef(null);
    const offlineQueueRef = useRef(null);
    
    // Initialize offline queue
    if (!offlineQueueRef.current) {
        offlineQueueRef.current = new OfflineQueue('document-1');
    }
    
    // Use offline detection
    const { isOnline, isOffline, wasOffline } = useOffline();

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
            case 'operation_ack':
                // Handle operation acknowledgment (remove from queue if successful)
                if (data.success && data.operationId) {
                    offlineQueueRef.current.removeProcessed([data.operationId]);
                    // Trigger re-render by updating pending count
                    if (editorRef.current && typeof editorRef.current.getCRDT === 'function') {
                        const crdt = editorRef.current.getCRDT();
                        crdt.handleOperationAck(data.operationId, data.success);
                    }
                }
                break;
            default:
                console.warn('Unknown WebSocket message type:', data.type);
        }
    }, []);

    // WebSocket URL configuration
    const isDevelopment = import.meta.env?.MODE !== 'production';
    const wsUrl = isDevelopment ? 'ws://localhost:3001' : 'wss://your-vercel-app.vercel.app';

    // Initialize WebSocket connection with offline support
    const { send, connectionState, reconnect, pendingOperationsCount, syncQueuedOperations } = useWebSocket(
        wsUrl, 
        handleWebSocketMessage, 
        offlineQueueRef.current
    );

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
        
        // Show offline status if browser is offline
        if (isOffline) {
            return { ...baseStyle, backgroundColor: '#ffeaa7', color: '#2d3436' };
        }
        
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

    const getStatusText = () => {
        if (isOffline) return 'offline';
        return connectionState.toLowerCase();
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '20px' }}>
                <h1 style={{ margin: '0 0 10px 0' }}>Collaborative Text Editor</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>Active users: {userCount}</span>
                    <span style={getConnectionStatusStyle()}>
                        {getStatusText()}
                    </span>
                    {pendingOperationsCount > 0 && (
                        <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#ff7675',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}>
                            {pendingOperationsCount} pending
                        </span>
                    )}
                    {connectionState === 'DISCONNECTED' && isOnline && (
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
                    {pendingOperationsCount > 0 && connectionState === 'CONNECTED' && (
                        <button 
                            onClick={syncQueuedOperations} 
                            style={{ 
                                padding: '4px 8px', 
                                fontSize: '12px',
                                backgroundColor: '#00b894',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Sync Now
                        </button>
                    )}
                </div>
            </header>

            <TextEditor
                ref={editorRef}
                onOperation={handleEditorOperation}
                initialContent=""
                offlineQueue={offlineQueueRef.current}
            />

            <footer style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
                <p>💡 Tip: Open this page in multiple browser tabs or share the URL to see real-time collaboration!</p>
                <p>🚀 This editor works offline! Your changes are saved locally and will sync when you're back online.</p>
            </footer>
        </div>
    );
}

export default App;
