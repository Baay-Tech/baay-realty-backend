// websocket.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ noServer: true });

const clients = new Map();

wss.on('connection', (ws, request) => {
  const userId = request.headers['user-id'];
  const userRole = request.headers['user-role'];
  
  if (userId && userRole) {
    clients.set(`${userRole}-${userId}`, ws);
    console.log(`New connection: ${userRole}-${userId}`);
  }

  ws.on('close', () => {
    clients.delete(`${userRole}-${userId}`);
    console.log(`Connection closed: ${userRole}-${userId}`);
  });
});

function sendNotification(userId, userRole, notification) {
  const clientKey = `${userRole}-${userId}`;
  const client = clients.get(clientKey);
  
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(notification));
    return true;
  }
  return false;
}

module.exports = { wss, sendNotification };