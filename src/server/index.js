const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../../dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Store connected clients
let clients = new Set();
let userCount = 0;

wss.on('connection', (ws) => {
    userCount++;
    clients.add(ws);

    // Notify all clients about user count change
    broadcast({ type: 'users_update', count: userCount });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'operation') {
                // Broadcast operation to all other clients
                broadcast({
                    type: 'operation',
                    operation: data.operation
                }, ws);

                // Send acknowledgment back to sender (especially important for sync operations)
                if (data.isSync && data.operation.id) {
                    ws.send(JSON.stringify({
                        type: 'operation_ack',
                        operationId: data.operation.id,
                        success: true
                    }));
                }
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            
            // Send error acknowledgment for sync operations
            if (data.isSync && data.operation && data.operation.id) {
                ws.send(JSON.stringify({
                    type: 'operation_ack',
                    operationId: data.operation.id,
                    success: false,
                    error: error.message
                }));
            }
        }
    });

    ws.on('close', () => {
        userCount--;
        clients.delete(ws);
        broadcast({ type: 'users_update', count: userCount });
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function broadcast(data, excludeWs = null) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});