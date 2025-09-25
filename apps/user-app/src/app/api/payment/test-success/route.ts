import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Success</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: #27ae60; }
        .info { color: #3498db; }
      </style>
    </head>
    <body>
      <h2 class="success">Test Success Page</h2>
      <p class="info">This page simulates a successful payment.</p>
      <p>Time: ${new Date().toISOString()}</p>
      <script>
        console.log('Test success page loaded');
        
        function sendSuccessMessage() {
          const message = {
            type: 'payment_success',
            fileId: 'test-file-123',
            paymentId: 'test-payment-456',
            timestamp: new Date().toISOString()
          };
          
          console.log('Sending test success message:', message);
          
          // Try multiple methods
          if (window.opener) {
            console.log('Sending to window.opener');
            window.opener.postMessage(message, '*');
          }
          
          if (window.parent !== window) {
            console.log('Sending to window.parent');
            window.parent.postMessage(message, '*');
          }
          
          try {
            if (window.top !== window) {
              console.log('Sending to window.top');
              window.top.postMessage(message, '*');
            }
          } catch (e) {
            console.log('Cannot access window.top:', e);
          }
        }
        
        // Send message immediately
        sendSuccessMessage();
        
        // Send message after delay
        setTimeout(sendSuccessMessage, 1000);
        setTimeout(sendSuccessMessage, 2000);
        
        // Try to close window
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log('Cannot close window:', e);
          }
        }, 3000);
      </script>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}
