#!/usr/bin/env node

/**
 * Simple test server for SMS Forwarder
 * Run this to test the SMS forwarding functionality
 */

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Store received messages
const receivedMessages = [];

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const timestamp = new Date().toISOString();
        
        console.log(`📨 Received SMS data at ${timestamp}:`);
        console.log(JSON.stringify(data, null, 2));
        
        // Store the message
        receivedMessages.push({
          timestamp,
          data
        });
        
        // Keep only last 50 messages
        if (receivedMessages.length > 50) {
          receivedMessages.shift();
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'SMS data received successfully',
          receivedAt: timestamp
        }));
        
      } catch (error) {
        console.error('❌ Error parsing JSON:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON' 
        }));
      }
    });
  } else if (req.method === 'GET') {
    if (parsedUrl.pathname === '/messages') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: receivedMessages.length,
        messages: receivedMessages
      }));
    } else if (parsedUrl.pathname === '/clear') {
      receivedMessages.length = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'All messages cleared'
      }));
    } else {
      // Serve a simple HTML page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>SMS Forwarder Test Server</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .success { background-color: #d4edda; color: #155724; }
            .info { background-color: #d1ecf1; color: #0c5460; }
            .message { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .timestamp { color: #666; font-size: 0.9em; }
            .sms-data { background-color: #f8f9fa; padding: 10px; border-radius: 3px; margin-top: 10px; }
            button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
            .btn-primary { background-color: #007bff; color: white; }
            .btn-danger { background-color: #dc3545; color: white; }
            .btn-success { background-color: #28a745; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📱 SMS Forwarder Test Server</h1>
            
            <div class="status info">
              <strong>Server Status:</strong> Running on port ${PORT}
            </div>
            
            <div class="status success">
              <strong>Endpoint URL:</strong> http://localhost:${PORT}
            </div>
            
            <div>
              <button class="btn-primary" onclick="loadMessages()">🔄 Refresh Messages</button>
              <button class="btn-danger" onclick="clearMessages()">🗑️ Clear All</button>
              <button class="btn-success" onclick="copyEndpoint()">📋 Copy Endpoint URL</button>
            </div>
            
            <div id="messages">
              <h2>📨 Received Messages (<span id="count">0</span>)</h2>
              <div id="messagesList">
                <p>No messages received yet. Send SMS messages to your device to see them here.</p>
              </div>
            </div>
          </div>
          
          <script>
            function loadMessages() {
              fetch('/messages')
                .then(response => response.json())
                .then(data => {
                  const messagesList = document.getElementById('messagesList');
                  const count = document.getElementById('count');
                  
                  count.textContent = data.count;
                  
                  if (data.count === 0) {
                    messagesList.innerHTML = '<p>No messages received yet.</p>';
                    return;
                  }
                  
                  messagesList.innerHTML = data.messages.map(msg => \`
                    <div class="message">
                      <div class="timestamp">📅 \${msg.timestamp}</div>
                      <div class="sms-data">
                        <strong>Messages:</strong> \${msg.data.messages ? msg.data.messages.length : 0}<br>
                        <strong>Sync Time:</strong> \${msg.data.sync_time}<br>
                        <strong>Test:</strong> \${msg.data.test ? 'Yes' : 'No'}
                        \${msg.data.messages ? \`
                          <br><br><strong>SMS Details:</strong>
                          \${msg.data.messages.map(sms => \`
                            <br>• From: \${sms.address} | \${sms.body.substring(0, 50)}\${sms.body.length > 50 ? '...' : ''}
                          \`).join('')}
                        \` : ''}
                      </div>
                    </div>
                  \`).join('');
                })
                .catch(error => {
                  console.error('Error loading messages:', error);
                  document.getElementById('messagesList').innerHTML = '<p>Error loading messages.</p>';
                });
            }
            
            function clearMessages() {
              if (confirm('Are you sure you want to clear all messages?')) {
                fetch('/clear')
                  .then(response => response.json())
                  .then(data => {
                    if (data.success) {
                      loadMessages();
                    }
                  })
                  .catch(error => {
                    console.error('Error clearing messages:', error);
                  });
              }
            }
            
            function copyEndpoint() {
              const endpoint = \`http://localhost:\${${PORT}}\`;
              navigator.clipboard.writeText(endpoint).then(() => {
                alert('Endpoint URL copied to clipboard!');
              }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = endpoint;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Endpoint URL copied to clipboard!');
              });
            }
            
            // Load messages on page load
            loadMessages();
            
            // Auto-refresh every 5 seconds
            setInterval(loadMessages, 5000);
          </script>
        </body>
        </html>
      `);
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed' 
    }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 SMS Forwarder Test Server running on port ${PORT}`);
  console.log(`📱 Add this URL to your SMS Forwarder app: http://localhost:${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser to view received messages`);
  console.log(`📋 API endpoints:`);
  console.log(`   POST / - Receive SMS data`);
  console.log(`   GET /messages - View all received messages`);
  console.log(`   GET /clear - Clear all messages`);
  console.log(`\n💡 Tip: Use this server to test your SMS Forwarder app!`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 