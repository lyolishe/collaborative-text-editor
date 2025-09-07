import { useEffect, useRef } from 'react';

export const useWebSocket = (url, onMessage) => {
    const wsRef = useRef(null);

    useEffect(() => {
        const connect = () => {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                console.log('Connected to WebSocket server');
                wsRef.current = ws;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket connection closed');
                setTimeout(connect, 3000); // Переподключение через 3 секунды
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [url, onMessage]);

    const send = (data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    };

    return { send };
};