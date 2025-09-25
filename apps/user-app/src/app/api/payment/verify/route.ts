import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Accept JSON body if present, else fallback to query params (some WebViews send form/query)
    let razorpay_order_id: string | null = null;
    let razorpay_payment_id: string | null = null;
    let razorpay_signature: string | null = null;
    let fileId: string | null = null;
    let userId: string | null = null;

    try {
      const body = await request.json();
      razorpay_order_id = body?.razorpay_order_id ?? null;
      razorpay_payment_id = body?.razorpay_payment_id ?? null;
      razorpay_signature = body?.razorpay_signature ?? null;
      fileId = body?.fileId ?? null;
      userId = body?.userId ?? null;
    } catch {}

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      const url = new URL(request.url);
      const qs = url.searchParams;
      razorpay_order_id = razorpay_order_id || qs.get('razorpay_order_id');
      razorpay_payment_id = razorpay_payment_id || qs.get('razorpay_payment_id');
      razorpay_signature = razorpay_signature || qs.get('razorpay_signature');
      fileId = fileId || qs.get('fileId');
      userId = userId || qs.get('userId');
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      try {
        await adminDb.collection('payment_logs').add({
          kind: 'verify',
          source: 'verify:POST',
          success: false,
          reason: 'missing_params',
          userAgent: request.headers.get('user-agent') || null,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          createdAt: new Date().toISOString()
        });
      } catch {}
      return NextResponse.json(
        { success: false, message: 'Missing required payment verification data' },
        { status: 400 }
      );
    }

    // Verify the signature using Razorpay key secret
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!razorpayKeySecret) {
      return NextResponse.json(
        { success: false, message: 'Server misconfiguration: missing Razorpay key secret' },
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
      try {
        await adminDb.collection('payment_logs').add({
          kind: 'verify',
          source: 'verify:POST',
          success: false,
          reason: 'invalid_signature',
          fileId,
          userId,
          razorpay_order_id,
          razorpay_payment_id,
          createdAt: new Date().toISOString()
        });
      } catch {}
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
    try {
      await adminDb.collection('payment_logs').add({
        kind: 'verify',
        source: 'verify:POST',
        success: false,
        reason: 'exception',
        error: typeof error === 'object' ? String(error) : error,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        createdAt: new Date().toISOString()
      });
    } catch {}
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
      try {
        await adminDb.collection('payment_logs').add({
          kind: 'verify',
          source: 'verify:GET',
          success: false,
          reason: 'missing_params',
          query: Object.fromEntries(searchParams.entries()),
          userAgent: request.headers.get('user-agent') || null,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          createdAt: new Date().toISOString()
        });
      } catch {}
      const origin = new URL(request.url).origin;
      return NextResponse.redirect(`${origin}/payment/status?payment=failed&code=missing_params`);
    }

    // Reuse POST logic by constructing a fake request body
    const verifyReq = new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, fileId, userId })
    });
    // Call POST verification internally
    const result = await POST(verifyReq as any);
    const data = await result.json();

    try {
      await adminDb.collection('payment_logs').add({
        kind: 'verify',
        source: 'verify:GET',
        success: !!data?.success,
        fileId,
        userId,
        razorpay_order_id,
        razorpay_payment_id,
        message: data?.message || null,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        createdAt: new Date().toISOString()
      });
    } catch {}

    const origin = new URL(request.url).origin;
    const redirect = new URL('/payment/status', origin);
    redirect.searchParams.set('payment', data.success ? 'success' : 'failed');
    if (fileId) redirect.searchParams.set('fileId', fileId);
    if (data?.message) redirect.searchParams.set('msg', encodeURIComponent(data.message));
    return NextResponse.redirect(redirect.toString());
  } catch (error: any) {
    try {
      await adminDb.collection('payment_logs').add({
        kind: 'verify',
        source: 'verify:GET',
        success: false,
        reason: 'exception',
        error: typeof error === 'object' ? String(error) : error,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        createdAt: new Date().toISOString()
      });
    } catch {}
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/payment/status?payment=failed&code=exception`);
  }
}