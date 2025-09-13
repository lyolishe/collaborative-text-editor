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
 * exponential backoff, connection state management, and offline support.
 */
export const useWebSocket = (url, onMessage, offlineQueue = null) => {
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const [connectionState, setConnectionState] = useState(CONNECTION_STATES.DISCONNECTED);
    const [pendingOperationsCount, setPendingOperationsCount] = useState(0);
    const syncingRef = useRef(false);

    // Configuration constants
    const maxReconnectDelay = 30000; // 30 seconds maximum delay
    const baseReconnectDelay = 1000; // 1 second base delay
    const maxReconnectAttempts = 10;

    // Stable reference to prevent unnecessary reconnections
    const stableOnMessage = useCallback(onMessage, []);

    // Update pending operations count when queue changes
    const updatePendingCount = useCallback(() => {
        if (offlineQueue) {
            setPendingOperationsCount(offlineQueue.size());
        }
    }, [offlineQueue]);

    // Sync queued operations when connection is restored
    const syncQueuedOperations = useCallback(async () => {
        if (!offlineQueue || syncingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        const queuedOps = offlineQueue.getAll();
        if (queuedOps.length === 0) {
            return;
        }

        syncingRef.current = true;
        console.log(`Syncing ${queuedOps.length} queued operations`);

        try {
            // Send operations in chronological order
            for (const operation of queuedOps) {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'operation',
                        operation: operation,
                        isSync: true // Mark as sync operation
                    }));

                    // Small delay to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 10));
                } else {
                    break; // Connection lost during sync
                }
            }
        } catch (error) {
            console.error('Error syncing operations:', error);
        } finally {
            syncingRef.current = false;
            updatePendingCount();
        }
    }, [offlineQueue, updatePendingCount]);

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

                // Trigger sync of queued operations when connected
                setTimeout(() => {
                    syncQueuedOperations();
                }, 100);
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

                // If this was a queued operation that got sent successfully,
                // we'll handle the acknowledgment when the server responds
                if (data.operation && data.operation.id && offlineQueue) {
                    // Don't remove from queue yet - wait for server acknowledgment
                }
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);

                // If sending failed and this is an operation, queue it
                if (data.type === 'operation' && offlineQueue) {
                    offlineQueue.enqueue(data.operation);
                    updatePendingCount();
                }
            }
        } else {
            // Connection not available - queue operation if it's an operation
            if (data.type === 'operation' && offlineQueue) {
                offlineQueue.enqueue(data.operation);
                updatePendingCount();
            }
        }
    }, [offlineQueue, updatePendingCount]);

    const manualReconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0; // Reset attempts for manual reconnection
        cleanup();
        connect();
    }, [cleanup, connect]);

    // Initialize pending count on mount
    useEffect(() => {
        updatePendingCount();
    }, [updatePendingCount]);

    return {
        send,
        connectionState,
        reconnect: manualReconnect,
        pendingOperationsCount,
        syncQueuedOperations,
        isSyncing: syncingRef.current
    };
};