import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const info = {
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    searchParams: Object.fromEntries(searchParams.entries()),
    razorpay_order_id: searchParams.get('razorpay_order_id'),
    razorpay_payment_id: searchParams.get('razorpay_payment_id'),
    razorpay_signature: searchParams.get('razorpay_signature'),
    fileId: searchParams.get('fileId'),
    userId: searchParams.get('userId'),
    allParams: Array.from(searchParams.entries())
  };

  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Info</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .success { color: #27ae60; }
        .error { color: #e74c3c; }
      </style>
    </head>
    <body>
      <h2>Payment Information</h2>
      <pre>${JSON.stringify(info, null, 2)}</pre>
      <p><a href="/api/payment/test">Test Endpoint</a></p>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}
