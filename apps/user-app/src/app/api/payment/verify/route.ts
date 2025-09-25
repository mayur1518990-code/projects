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

    // Verify the signature using Razorpay key secret (not webhook secret)
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeySecret) {
      return NextResponse.json(
        { success: false, message: 'Server misconfigured: missing RAZORPAY_KEY_SECRET' },
        { status: 500 }
      );
    }
    const bodyString = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
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

    let paymentDoc = paymentsSnapshot.docs[0];
    if (!paymentDoc) {
      // In redirect/WebView flow, the client handler may not have run yet.
      // Create a minimal payment record now so we can mark it captured.
      const newPaymentRef = adminDb.collection('payments').doc();
      const paymentDocument = {
        id: newPaymentRef.id,
        fileId,
        userId,
        amount: null,
        currency: 'INR',
        status: 'created',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          source: 'verify-fallback'
        }
      };
      await newPaymentRef.set(paymentDocument);
      paymentDoc = await newPaymentRef.get();
    }

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

// Support Razorpay redirect/callback with GET for WebViews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const razorpay_order_id = searchParams.get('razorpay_order_id');
    const razorpay_payment_id = searchParams.get('razorpay_payment_id');
    const razorpay_signature = searchParams.get('razorpay_signature');
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Missing required payment verification data' },
        { status: 400 }
      );
    }

    // Reuse POST logic by constructing a fake request body
    const verifyReq = new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, fileId, userId })
    });
    // Call POST verification internally
    const result = await POST(verifyReq as any);
    return result;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'An error occurred while verifying payment (GET)' },
      { status: 500 }
    );
  }
}