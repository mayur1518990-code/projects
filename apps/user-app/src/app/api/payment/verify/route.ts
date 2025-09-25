import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      fileId,
      userId 
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Missing required payment verification data' },
        { status: 400 }
      );
    }

    // Verify the signature (in production, use your actual webhook secret)
    const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';
    const bodyString = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayWebhookSecret)
      .update(bodyString)
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Find the payment record
    const paymentsSnapshot = await adminDb
      .collection('payments')
      .where('razorpayOrderId', '==', razorpay_order_id)
      .where('fileId', '==', fileId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'Payment record not found' },
        { status: 404 }
      );
    }

    const paymentDoc = paymentsSnapshot.docs[0];
    const paymentData = paymentDoc.data();

    // Update payment status to captured
    await paymentDoc.ref.update({
      status: 'captured',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      updatedAt: new Date().toISOString(),
    });

    // Update file status to paid
    await adminDb.collection('files').doc(fileId).update({
      status: 'paid',
      updatedAt: new Date().toISOString(),
    });


    return NextResponse.json({
      success: true,
      message: 'Payment verified and captured successfully',
      payment_id: razorpay_payment_id,
      file_id: fileId
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'An error occurred while verifying payment' },
      { status: 500 }
    );
  }
}

// Support Razorpay redirect/callback with GET for WebViews and mobile apps
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const razorpay_order_id = searchParams.get('razorpay_order_id');
    const razorpay_payment_id = searchParams.get('razorpay_payment_id');
    const razorpay_signature = searchParams.get('razorpay_signature');
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      // Return a user-friendly error page for mobile apps
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
            .success { color: #27ae60; }
          </style>
        </head>
        <body>
          <h2 class="error">Payment Error</h2>
          <p>Missing payment verification data. Please try again.</p>
          <script>
            // For mobile apps, try to close the payment window
            if (window.opener) {
              window.opener.postMessage({type: 'payment_error', message: 'Missing verification data'}, '*');
              window.close();
            } else if (window.parent !== window) {
              window.parent.postMessage({type: 'payment_error', message: 'Missing verification data'}, '*');
            }
          </script>
        </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Reuse POST logic by constructing a fake request body
    const verifyReq = new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, fileId, userId })
    });
    
    // Call POST verification internally
    const result = await POST(verifyReq as any);
    
    // If verification was successful, return a success page for mobile apps
    if (result.status === 200) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #27ae60; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h2 class="success">Payment Successful!</h2>
          <p>Your payment has been processed successfully.</p>
          <p>File ID: ${fileId}</p>
          <script>
            // For mobile apps, notify parent window of success
            if (window.opener) {
              window.opener.postMessage({type: 'payment_success', fileId: '${fileId}'}, '*');
              window.close();
            } else if (window.parent !== window) {
              window.parent.postMessage({type: 'payment_success', fileId: '${fileId}'}, '*');
            }
            
            // Auto-close after 3 seconds
            setTimeout(() => {
              if (window.opener) window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // If verification failed, return error page
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Failed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h2 class="error">Payment Failed</h2>
        <p>Payment verification failed. Please contact support.</p>
        <script>
          // For mobile apps, notify parent window of failure
          if (window.opener) {
            window.opener.postMessage({type: 'payment_error', message: 'Verification failed'}, '*');
            window.close();
          } else if (window.parent !== window) {
            window.parent.postMessage({type: 'payment_error', message: 'Verification failed'}, '*');
          }
        </script>
      </body>
      </html>
    `, {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error: any) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h2 class="error">Payment Error</h2>
        <p>An error occurred while verifying payment. Please try again.</p>
        <script>
          // For mobile apps, notify parent window of error
          if (window.opener) {
            window.opener.postMessage({type: 'payment_error', message: 'Verification error'}, '*');
            window.close();
          } else if (window.parent !== window) {
            window.parent.postMessage({type: 'payment_error', message: 'Verification error'}, '*');
          }
        </script>
      </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}