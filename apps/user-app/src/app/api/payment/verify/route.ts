import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCacheKey, setCached } from '@/lib/cache';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const url = new URL(request.url);
    const isFormPost = contentType.includes('application/x-www-form-urlencoded');

    let razorpay_order_id: string | null = null;
    let razorpay_payment_id: string | null = null;
    let razorpay_signature: string | null = null;
    let fileId: string | null = null;
    let userId: string | null = null;

    if (isFormPost) {
      const form = await request.formData();
      razorpay_order_id = (form.get('razorpay_order_id') as string) || null;
      razorpay_payment_id = (form.get('razorpay_payment_id') as string) || null;
      razorpay_signature = (form.get('razorpay_signature') as string) || null;
      // fileId and userId provided via callback_url query
      fileId = url.searchParams.get('fileId');
      userId = url.searchParams.get('userId');
    } else {
      const body = await request.json();
      razorpay_order_id = body.razorpay_order_id;
      razorpay_payment_id = body.razorpay_payment_id;
      razorpay_signature = body.razorpay_signature;
      fileId = body.fileId;
      userId = body.userId;
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      const err = NextResponse.json(
        { success: false, message: 'Missing required payment verification data' },
        { status: 400 }
      );
      if (isFormPost) {
        return NextResponse.redirect(new URL('/files?payment=failed', url.origin), 303);
      }
      return err;
    }

    // Verify the signature using KEY SECRET per Razorpay docs
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const bodyString = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(bodyString)
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      if (isFormPost) {
        return NextResponse.redirect(new URL('/files?payment=failed', url.origin), 303);
      }
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
      if (isFormPost) {
        return NextResponse.redirect(new URL('/files?payment=failed', url.origin), 303);
      }
      return NextResponse.json(
        { success: false, message: 'Payment record not found' },
        { status: 404 }
      );
    }

    const paymentDoc = paymentsSnapshot.docs[0];

    await paymentDoc.ref.update({
      status: 'captured',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      updatedAt: new Date().toISOString(),
    });

    await adminDb.collection('files').doc(fileId).update({
      status: 'paid',
      updatedAt: new Date().toISOString(),
    });

    // CRITICAL FIX: Clear the cache for this user's files and single file
    // This ensures the updated payment status is immediately reflected
    const cacheKey = getCacheKey('user_files', userId);
    const singleFileCacheKey = getCacheKey('single_file', `${userId}_${fileId}`);
    setCached(cacheKey, null, 0);
    setCached(singleFileCacheKey, null, 0);

    if (isFormPost) {
      return NextResponse.redirect(new URL('/files?payment=success', url.origin), 303);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and captured successfully',
      payment_id: razorpay_payment_id,
      file_id: fileId
    });

  } catch (error: any) {
    try {
      const url = new URL(request.url);
      return NextResponse.redirect(new URL('/files?payment=failed', url.origin), 303);
    } catch {
      return NextResponse.json(
        { success: false, message: 'An error occurred while verifying payment' },
        { status: 500 }
      );
    }
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