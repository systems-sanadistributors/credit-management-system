const clients = new Set();

function addClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {"ok":true}\n\n');

  const client = { res };
  clients.add(client);

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

function broadcastEvent(eventName, payload) {
  const serialized = JSON.stringify(payload);
  const frame = `event: ${eventName}\ndata: ${serialized}\n\n`;
  for (const client of clients) {
    client.res.write(frame);
  }
}

module.exports = { addClient, broadcastEvent };
