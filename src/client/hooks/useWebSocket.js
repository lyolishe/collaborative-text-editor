import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * WebSocket connection states for UI feedback
 */
const CONNECTION_STATES = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING', 
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING'
};

/**
 * Custom hook for WebSocket connection with automatic reconnection,
 * exponential backoff, and connection state management.
 */
export const useWebSocket = (url, onMessage) => {
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const [connectionState, setConnectionState] = useState(CONNECTION_STATES.DISCONNECTED);
    
    // Configuration constants
    const maxReconnectDelay = 30000; // 30 seconds maximum delay
    const baseReconnectDelay = 1000; // 1 second base delay
    const maxReconnectAttempts = 10;

    // Stable reference to prevent unnecessary reconnections
    const stableOnMessage = useCallback(onMessage, []);

    // Calculate exponential backoff delay
    const getReconnectDelay = () => {
        const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current), maxReconnectDelay);
        return delay + Math.random() * 1000; // Add jitter
    };

    const cleanup = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.onopen = null;
            wsRef.current.onclose = null;
            wsRef.current.onmessage = null;
            wsRef.current.onerror = null;
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
            wsRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        // Prevent multiple simultaneous connection attempts
        if (connectionState === CONNECTION_STATES.CONNECTING || 
            connectionState === CONNECTION_STATES.CONNECTED) {
            return;
        }

        // Stop trying after max attempts
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setConnectionState(CONNECTION_STATES.DISCONNECTED);
            return;
        }

        setConnectionState(CONNECTION_STATES.CONNECTING);

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                wsRef.current = ws;
                reconnectAttemptsRef.current = 0; // Reset on successful connection
                setConnectionState(CONNECTION_STATES.CONNECTED);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    stableOnMessage(data);
                } catch (error) {
                    console.error('WebSocket: Failed to parse message:', error);
                }
            };

            ws.onclose = (event) => {
                wsRef.current = null;
                
                // Don't reconnect if closed intentionally or max attempts reached
                if (event.code === 1000 || reconnectAttemptsRef.current >= maxReconnectAttempts) {
                    setConnectionState(CONNECTION_STATES.DISCONNECTED);
                    return;
                }

                // Schedule reconnection with exponential backoff
                setConnectionState(CONNECTION_STATES.RECONNECTING);
                reconnectAttemptsRef.current++;
                const delay = getReconnectDelay();
                
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, delay);
            };

            ws.onerror = (error) => {
                console.error('WebSocket connection error:', error);
                setConnectionState(CONNECTION_STATES.DISCONNECTED);
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            setConnectionState(CONNECTION_STATES.DISCONNECTED);
        }
    }, [url, connectionState, stableOnMessage]);

    useEffect(() => {
        connect();

        return cleanup;
    }, [url, connect, cleanup]);

    const send = useCallback((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(JSON.stringify(data));
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
            }
        }
    }, []);

    const manualReconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0; // Reset attempts for manual reconnection
        cleanup();
        connect();
    }, [cleanup, connect]);

    return { 
        send, 
        connectionState, 
        reconnect: manualReconnect
    };
};