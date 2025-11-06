import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCacheKey, setCached } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      fileId, 
      userId, 
      amount, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      status 
    } = body;

    if (!fileId || !userId || !amount || !razorpay_payment_id) {
      return NextResponse.json(
        { success: false, message: 'Missing required payment data' },
        { status: 400 }
      );
    }


    // Create payment record in Firestore
    const paymentData = {
      fileId,
      userId,
      amount: amount, // Store original amount in rupees
      currency: 'INR',
      status: status || 'captured',
      razorpayOrderId: razorpay_order_id || `order_${Date.now()}`,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature || null, // Handle undefined values
      paymentMethod: 'razorpay',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      }
    };


    let paymentId;
    const paymentRef = await adminDb.collection('payments').where('fileId', '==', fileId).limit(1).get();

    if (!paymentRef.empty) {
      const paymentDoc = paymentRef.docs[0];
      paymentId = paymentDoc.id;
      await paymentDoc.ref.update(paymentData);
    } else {
      const newPaymentRef = adminDb.collection('payments').doc();
      paymentId = newPaymentRef.id;
      const paymentDocument = {
        id: paymentId,
        ...paymentData,
      };
      await newPaymentRef.set(paymentDocument);
    }

    // Update file status to "paid" ONLY - NO automatic assignment
    try {
      const now = new Date().toISOString();
      
      // Parallel execution: Update file AND clear cache simultaneously
      await Promise.all([
        adminDb.collection('files').doc(fileId).update({
          status: 'paid',
          updatedAt: now
        }),
        // Clear both caches in parallel
        Promise.resolve().then(() => {
          const cacheKey = getCacheKey('user_files', userId);
          const singleFileCacheKey = getCacheKey('single_file', `${userId}_${fileId}`);
          setCached(cacheKey, null, 0);
          setCached(singleFileCacheKey, null, 0);
        })
      ]);

      // Log async (don't wait for it)
      adminDb.collection('logs').add({
        actionType: 'file_status_updated',
        actorId: 'system',
        actorType: 'system',
        fileId,
        details: {
          newStatus: 'paid',
          triggeredBy: 'payment_success',
          note: 'File marked as paid. Awaiting smart assignment by admin.'
        },
        timestamp: new Date()
      }).catch(() => {}); // Silent fail on logging

    } catch (updateError) {
      // Don't fail the payment if file update fails
    }

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      message: 'Payment created successfully'
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create payment error:', error);
    }
    return NextResponse.json(
      { success: false, message: 'An error occurred while creating payment' },
      { status: 500 }
    );
  }
}

// Optional: GET callback endpoint to handle redirect flow and delegate to /api/payment/verify
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // When coming from redirect flow, Razorpay sends ids; include file/user if we added them in callback_url
  const razorpay_order_id = url.searchParams.get('razorpay_order_id');
  const razorpay_payment_id = url.searchParams.get('razorpay_payment_id');
  const razorpay_signature = url.searchParams.get('razorpay_signature');
  const fileId = url.searchParams.get('fileId');
  const userId = url.searchParams.get('userId');

  if (razorpay_order_id && razorpay_payment_id && razorpay_signature && fileId && userId) {
    // Proxy to verify endpoint
    const verifyUrl = new URL(request.url);
    verifyUrl.pathname = verifyUrl.pathname.replace('/create-payment', '/verify');
    const res = await fetch(verifyUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature, fileId, userId })
    });

    const data = await res.json();
    // Redirect user to files page regardless, with a toast hint via query
    const redirect = new URL('/files', url.origin);
    redirect.searchParams.set('payment', data.success ? 'success' : 'failed');
    return NextResponse.redirect(redirect.toString());
  }

  // Fallback redirect if no params found
  return NextResponse.redirect(new URL('/files?payment=failed', url.origin));
}
