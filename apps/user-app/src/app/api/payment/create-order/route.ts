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
    if (process.env.NODE_ENV === 'development') {
      console.log('Create payment order API called');
    }
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('Request body:', body);
    }
    
    const { fileId, userId, amount } = body;

    if (!fileId || !userId || !amount) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Missing required fields:', { fileId, userId, amount });
      }
      return NextResponse.json(
        { success: false, message: 'File ID, User ID, and amount are required' },
        { status: 400 }
      );
    }

    // Verify the file belongs to the user
    if (process.env.NODE_ENV === 'development') {
      console.log('Checking file ownership for fileId:', fileId, 'userId:', userId);
    }
    const fileDoc = await adminDb.collection('files').doc(fileId).get();
    
    if (!fileDoc.exists) {
      if (process.env.NODE_ENV === 'development') {
        console.error('File not found:', fileId);
      }
      return NextResponse.json(
        { success: false, message: 'File not found' },
        { status: 404 }
      );
    }

    const fileData = fileDoc.data();
    if (process.env.NODE_ENV === 'development') {
      console.log('File data:', fileData);
    }
    
    if (fileData?.userId !== userId) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Unauthorized access:', { fileUserId: fileData?.userId, requestUserId: userId });
      }
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

    const createOrderPayload = {
      amount: Math.round(Number(amount) * 100), // paise
      currency: 'INR',
      receipt: `file_${fileId}_${Date.now()}`,
      payment_capture: 1
    } as any;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify(createOrderPayload)
    });
    if (!rpRes.ok) {
      const txt = await rpRes.text();
      return NextResponse.json(
        { success: false, message: `Failed to create Razorpay order: ${rpRes.status} ${txt}` },
        { status: 502 }
      );
    }
    const rpOrder = await rpRes.json();
    const orderId = rpOrder.id as string;

    // Create payment record in Firestore
    const paymentData: CreatePaymentData = {
      fileId,
      userId,
      amount: amount, // Store original amount in rupees
      currency: 'INR',
      razorpayOrderId: orderId,
      paymentMethod: 'razorpay',
      metadata: {
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      }
    };

    const paymentRef = adminDb.collection('payments').doc();
    const paymentId = paymentRef.id;

    const paymentDocument = {
      id: paymentId,
      ...paymentData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'development') {

      console.log('Creating payment document:', paymentDocument);

    }
    await paymentRef.set(paymentDocument);

    if (process.env.NODE_ENV === 'development') {

      console.log('Payment order created successfully:', {
      paymentId,
      fileId,
      userId,
      amount: paymentData.amount,
      orderId,
      status: 'pending'
    });

    }

    const response = {
      success: true,
      order_id: orderId,
      payment_id: paymentId,
      amount: Math.round(Number(amount) * 100), // paise
      currency: 'INR'
    };

    if (process.env.NODE_ENV === 'development') {

      console.log('Returning response:', response);

    }
    return NextResponse.json(response);

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