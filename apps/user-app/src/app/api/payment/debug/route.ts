import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const userId = searchParams.get('userId');

    if (!fileId || !userId) {
      return NextResponse.json({
        success: false,
        message: 'Missing fileId or userId'
      });
    }

    // Get file details
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    const fileData = fileDoc.exists ? fileDoc.data() : null;

    // Get payment records for this file/user
    const paymentsSnapshot = await adminDb
      .collection('payments')
      .where('fileId', '==', fileId)
      .where('userId', '==', userId)
      .get();

    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      file: fileData,
      payments: payments,
      paymentCount: payments.length
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
}
