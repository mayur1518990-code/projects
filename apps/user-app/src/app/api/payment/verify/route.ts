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