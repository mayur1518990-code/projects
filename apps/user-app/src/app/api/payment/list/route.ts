import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const all = searchParams.get('all');

    if (process.env.NODE_ENV === 'development') {

      console.log('Listing payments...', { userId, all });

    }
    
    let paymentsSnapshot;
    
    if (userId && all !== 'true') {
      // Get payments for specific user
      paymentsSnapshot = await adminDb
        .collection('payments')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    } else {
      // Get all payments (admin view)
      paymentsSnapshot = await adminDb.collection('payments').get();
    }
    
    const payments: any[] = [];
    paymentsSnapshot.forEach((doc) => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        fileId: data.fileId,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        razorpayOrderId: data.razorpayOrderId,
        razorpayPaymentId: data.razorpayPaymentId,
        razorpaySignature: data.razorpaySignature,
        paymentMethod: data.paymentMethod,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        metadata: data.metadata || {}
      });
    });
    
    if (process.env.NODE_ENV === 'development') {
    
      console.log(`Found ${payments.length} payments in database`);
    
    }
    
    return NextResponse.json({
      success: true,
      count: payments.length,
      payments: payments
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List payments error:', error);
    }
    return NextResponse.json(
      { success: false, message: 'Failed to list payments', error: error.message },
      { status: 500 }
    );
  }
}
