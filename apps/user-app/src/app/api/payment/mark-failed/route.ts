import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { orderId, fileId, userId, reason } = await request.json();

    if (!orderId || !fileId || !userId) {
      return NextResponse.json(
        { success: false, message: 'orderId, fileId and userId are required' },
        { status: 400 }
      );
    }

    const paymentsSnapshot = await adminDb
      .collection('payments')
      .where('razorpayOrderId', '==', orderId)
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

    await paymentDoc.ref.update({
      status: 'failed',
      failureReason: reason || 'payment_failed',
      updatedAt: new Date().toISOString(),
    });

    // Do not set file to paid on failure; optionally keep file status unchanged or set to 'pending'
    await adminDb.collection('files').doc(fileId).update({
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'An error occurred while marking payment failed' },
      { status: 500 }
    );
  }
}


