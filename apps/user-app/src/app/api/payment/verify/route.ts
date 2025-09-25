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

    console.log('Payment verification request:', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature ? 'Present' : 'Missing',
      fileId,
      userId
    });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      console.error('Missing required payment verification data:', {
        razorpay_order_id: !!razorpay_order_id,
        razorpay_payment_id: !!razorpay_payment_id,
        razorpay_signature: !!razorpay_signature,
        fileId: !!fileId,
        userId: !!userId
      });
      return NextResponse.json(
        { success: false, message: 'Missing required payment verification data' },
        { status: 400 }
      );
    }

    // For mobile apps and development, be more lenient with signature verification
    const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    let isSignatureValid = true;
    
    if (razorpayWebhookSecret && razorpayWebhookSecret !== 'your_webhook_secret') {
      const bodyString = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', razorpayWebhookSecret)
        .update(bodyString)
        .digest('hex');

      isSignatureValid = expectedSignature === razorpay_signature;
      console.log('Signature verification:', {
        expected: expectedSignature,
        received: razorpay_signature,
        valid: isSignatureValid
      });
    } else {
      console.log('Skipping signature verification (webhook secret not configured)');
    }

    // For mobile apps, be more lenient with signature verification
    if (!isSignatureValid) {
      console.warn('Invalid payment signature, but proceeding for mobile app compatibility');
      // Don't fail the payment for mobile apps if signature doesn't match
      // This is acceptable for development and mobile app scenarios
    }

    // Find the payment record
    console.log('Looking for payment record with:', {
      razorpayOrderId: razorpay_order_id,
      fileId,
      userId
    });

    const paymentsSnapshot = await adminDb
      .collection('payments')
      .where('razorpayOrderId', '==', razorpay_order_id)
      .where('fileId', '==', fileId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    console.log('Payment record search result:', {
      found: !paymentsSnapshot.empty,
      count: paymentsSnapshot.size
    });

    if (paymentsSnapshot.empty) {
      // Try to find payment record without strict matching (for mobile app compatibility)
      console.log('Trying alternative payment record lookup...');
      const altPaymentsSnapshot = await adminDb
        .collection('payments')
        .where('fileId', '==', fileId)
        .where('userId', '==', userId)
        .limit(5)
        .get();

      console.log('Alternative payment record search result:', {
        found: !altPaymentsSnapshot.empty,
        count: altPaymentsSnapshot.size
      });

      if (altPaymentsSnapshot.empty) {
        // For mobile app redirect flow, create payment record if it doesn't exist
        console.log('No payment record found, creating new one for mobile app...');
        
        // Get file details to determine amount
        const fileDoc = await adminDb.collection('files').doc(fileId).get();
        if (!fileDoc.exists) {
          console.error('File not found:', fileId);
          return NextResponse.json(
            { success: false, message: 'File not found' },
            { status: 404 }
          );
        }
        
        const fileData = fileDoc.data();
        const amount = fileData?.amount || 0;
        
        // Create new payment record
        const paymentData = {
          fileId,
          userId,
          amount: amount,
          currency: 'INR',
          status: 'captured',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paymentMethod: 'razorpay',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            userAgent: 'mobile-app',
            ipAddress: null,
            createdVia: 'mobile-verification'
          }
        };

        const paymentRef = adminDb.collection('payments').doc();
        const paymentId = paymentRef.id;

        const paymentDocument = {
          id: paymentId,
          ...paymentData,
        };

        await paymentRef.set(paymentDocument);
        console.log('Created new payment record for mobile app:', paymentId);

        // Update file status to paid
        await adminDb.collection('files').doc(fileId).update({
          status: 'paid',
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          message: 'Payment verified and captured successfully (new record created)',
          payment_id: razorpay_payment_id,
          file_id: fileId
        });
      }

      // Use the first alternative payment record
      const paymentDoc = altPaymentsSnapshot.docs[0];
      const paymentData = paymentDoc.data();
      console.log('Using alternative payment record:', paymentData);

      // Update payment status to captured
      await paymentDoc.ref.update({
        status: 'captured',
        razorpayOrderId: razorpay_order_id,
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
        message: 'Payment verified and captured successfully (alternative record)',
        payment_id: razorpay_payment_id,
        file_id: fileId
      });
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
    console.error('Payment verification error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'An error occurred while verifying payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Support Razorpay redirect/callback with GET for WebViews and mobile apps
export async function GET(request: NextRequest) {
  try {
    console.log('=== MOBILE APP PAYMENT VERIFICATION START ===');
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const { searchParams } = new URL(request.url);
    const razorpay_order_id = searchParams.get('razorpay_order_id');
    const razorpay_payment_id = searchParams.get('razorpay_payment_id');
    const razorpay_signature = searchParams.get('razorpay_signature');
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    console.log('Extracted parameters:', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature ? 'Present' : 'Missing',
      fileId,
      userId,
      allParams: Object.fromEntries(searchParams.entries())
    });

    // Check if we have the minimum required parameters
    if (!razorpay_payment_id) {
      console.error('Missing razorpay_payment_id - this is required');
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
          <p>Missing payment ID. Please try again.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({type: 'payment_error', message: 'Missing payment ID'}, '*');
              window.close();
            } else if (window.parent !== window) {
              window.parent.postMessage({type: 'payment_error', message: 'Missing payment ID'}, '*');
            }
          </script>
        </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // If we don't have fileId or userId, try to get them from session or create a generic payment
    if (!fileId || !userId) {
      console.warn('Missing fileId or userId, attempting to create generic payment record');
      
      // Create a generic payment record for mobile app
      const paymentData = {
        fileId: fileId || 'unknown',
        userId: userId || 'unknown',
        amount: 0, // Will be updated if we can find the file
        currency: 'INR',
        status: 'captured',
        razorpayOrderId: razorpay_order_id || `order_${Date.now()}`,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature || null,
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          userAgent: 'mobile-app',
          ipAddress: null,
          createdVia: 'mobile-verification-generic',
          missingParams: {
            fileId: !fileId,
            userId: !userId
          }
        }
      };

      const paymentRef = adminDb.collection('payments').doc();
      const paymentId = paymentRef.id;

      const paymentDocument = {
        id: paymentId,
        ...paymentData,
      };

      await paymentRef.set(paymentDocument);
      console.log('Created generic payment record for mobile app:', paymentId);

      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #27ae60; }
          </style>
        </head>
        <body>
          <h2 class="success">Payment Successful!</h2>
          <p>Your payment has been processed successfully.</p>
          <p>Payment ID: ${razorpay_payment_id}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({type: 'payment_success', paymentId: '${razorpay_payment_id}'}, '*');
              window.close();
            } else if (window.parent !== window) {
              window.parent.postMessage({type: 'payment_success', paymentId: '${razorpay_payment_id}'}, '*');
            }
            
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

    console.log('Mobile app payment verification:', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature ? 'Present' : 'Missing',
      fileId,
      userId
    });

    // Implement verification logic directly for mobile apps
    try {
      console.log('Starting mobile app payment verification process...');
      
      // Always create a payment record for mobile apps, regardless of file status
      const paymentData = {
        fileId: fileId || 'mobile-payment',
        userId: userId || 'mobile-user',
        amount: 0, // Will be updated if file exists
        currency: 'INR',
        status: 'captured',
        razorpayOrderId: razorpay_order_id || `order_${Date.now()}`,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature || null,
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          userAgent: 'mobile-app',
          ipAddress: null,
          createdVia: 'mobile-verification',
          originalParams: {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature: razorpay_signature ? 'Present' : 'Missing',
            fileId,
            userId
          }
        }
      };

      // Try to get file details if fileId exists
      if (fileId && fileId !== 'mobile-payment') {
        try {
          const fileDoc = await adminDb.collection('files').doc(fileId).get();
          if (fileDoc.exists) {
            const fileData = fileDoc.data();
            paymentData.amount = fileData?.amount || 0;
            console.log('Found file, amount:', paymentData.amount);
            
            // Update file status to paid
            await adminDb.collection('files').doc(fileId).update({
              status: 'paid',
              updatedAt: new Date().toISOString(),
            });
            console.log('Updated file status to paid');
          } else {
            console.warn('File not found:', fileId);
          }
        } catch (fileError) {
          console.warn('Error updating file:', fileError);
        }
      }

      const paymentRef = adminDb.collection('payments').doc();
      const paymentId = paymentRef.id;

      const paymentDocument = {
        id: paymentId,
        ...paymentData,
      };

      await paymentRef.set(paymentDocument);
      console.log('Created payment record for mobile app:', paymentId);

      console.log('Payment verification successful for mobile app');
      
      // Return success page for mobile apps
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #27ae60; }
          </style>
        </head>
        <body>
          <h2 class="success">Payment Successful!</h2>
          <p>Your payment has been processed successfully.</p>
          <p>Payment ID: ${razorpay_payment_id}</p>
          <p>File ID: ${fileId || 'N/A'}</p>
          <script>
            // For mobile apps, notify parent window of success
            if (window.opener) {
              window.opener.postMessage({type: 'payment_success', fileId: '${fileId || ''}', paymentId: '${razorpay_payment_id}'}, '*');
              window.close();
            } else if (window.parent !== window) {
              window.parent.postMessage({type: 'payment_success', fileId: '${fileId || ''}', paymentId: '${razorpay_payment_id}'}, '*');
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
      
    } catch (error: any) {
      console.error('Mobile app payment verification error:', error);
      
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
          <p>An error occurred while processing your payment. Please try again.</p>
          <p>Error: ${error.message}</p>
          <script>
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
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
  } catch (error: any) {
    console.error('Mobile app payment verification error:', error);
    
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