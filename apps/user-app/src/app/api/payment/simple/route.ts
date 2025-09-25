import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Simple Payment Test</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: #27ae60; }
      </style>
    </head>
    <body>
      <h2 class="success">Payment Endpoint Working!</h2>
      <p>This endpoint is accessible from mobile apps.</p>
      <p>Time: ${new Date().toISOString()}</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({type: 'payment_success', message: 'Endpoint working'}, '*');
          window.close();
        } else if (window.parent !== window) {
          window.parent.postMessage({type: 'payment_success', message: 'Endpoint working'}, '*');
        }
      </script>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}
