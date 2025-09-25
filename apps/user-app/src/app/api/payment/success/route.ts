import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');
  const paymentId = searchParams.get('paymentId');
  
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: #27ae60; }
        .info { color: #3498db; }
        .button { 
          background: #27ae60; 
          color: white; 
          padding: 10px 20px; 
          border: none; 
          border-radius: 5px; 
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          margin: 10px;
        }
      </style>
    </head>
    <body>
      <h2 class="success">Payment Successful!</h2>
      <p>Your payment has been processed successfully.</p>
      <p class="info">File ID: ${fileId || 'N/A'}</p>
      <p class="info">Payment ID: ${paymentId || 'N/A'}</p>
      <p class="info">Time: ${new Date().toISOString()}</p>
      
      <a href="/files" class="button">Go to Files</a>
      <a href="/" class="button">Go to Home</a>
      
      <script>
        console.log('Payment success page loaded');
        
        // Try to communicate with parent window
        function notifyParent() {
          const message = {
            type: 'payment_success',
            fileId: '${fileId || ''}',
            paymentId: '${paymentId || ''}',
            timestamp: new Date().toISOString()
          };
          
          console.log('Sending success message:', message);
          
          if (window.opener) {
            window.opener.postMessage(message, '*');
          }
          
          if (window.parent !== window) {
            window.parent.postMessage(message, '*');
          }
          
          try {
            if (window.top !== window) {
              window.top.postMessage(message, '*');
            }
          } catch (e) {
            console.log('Cannot access window.top:', e);
          }
        }
        
        // Send message immediately
        notifyParent();
        
        // Send message after delay
        setTimeout(notifyParent, 1000);
        setTimeout(notifyParent, 2000);
        
        // Auto-redirect after 5 seconds
        setTimeout(() => {
          window.location.href = '/files';
        }, 5000);
      </script>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}
