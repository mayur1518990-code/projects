import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Define the interface locally to avoid import issues
interface CreatePaymentData {
  fileId: string;
  userId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  paymentMethod: string;
  metadata?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, userId, amount } = body;

    if (!fileId || !userId || !amount) {
      return NextResponse.json(
        { success: false, message: 'File ID, User ID, and amount are required' },
        { status: 400 }
      );
    }

    // Verify the file belongs to the user
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    const fileData = fileDoc.data();
    if (fileData?.userId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to create payment for this file' },
        { status: 403 }
      );
    }

    // Create real order with Razorpay Orders API
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { success: false, message: 'Razorpay keys not configured on server' },
        { status: 500 }
      );
    }

    const amountInPaise = Math.round(Number(amount) * 100);
    
    // Create Razorpay order with timeout
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for faster response
    
    let rpOrder;
    try {
      const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `file_${fileId}_${Date.now()}`,
          payment_capture: 1
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!rpRes.ok) {
        const errorText = await rpRes.text();
        if (process.env.NODE_ENV === 'development') {
          console.error('Razorpay API error:', rpRes.status, errorText);
        }
        return NextResponse.json(
          { success: false, message: 'Failed to create Razorpay order' },
          { status: 502 }
        );
      }
      rpOrder = await rpRes.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (process.env.NODE_ENV === 'development') {
        console.error('Razorpay fetch error:', err.message);
      }
      return NextResponse.json(
        { success: false, message: err.name === 'AbortError' ? 'Razorpay API timeout' : 'Razorpay API error' },
        { status: 504 }
      );
    }
    
    const orderId = rpOrder.id as string;

    // Create payment record in Firestore (minimal data for speed)
    const paymentRef = adminDb.collection('payments').doc();
    const paymentId = paymentRef.id;
    const now = new Date().toISOString();

    await paymentRef.set({
      id: paymentId,
      fileId,
      userId,
      amount,
      currency: 'INR',
      razorpayOrderId: orderId,
      paymentMethod: 'razorpay',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      }
    });

    return NextResponse.json({
      success: true,
      order_id: orderId,
      payment_id: paymentId,
      amount: amountInPaise,
      currency: 'INR'
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create payment order error:', error);
    }
    return NextResponse.json(
      { success: false, message: 'An error occurred while creating payment order' },
      { status: 500 }
    );
  }
}