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
      userId,
      amount
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

    let paymentDoc;
    let paymentData;

    if (paymentsSnapshot.empty) {
      // No payment record exists yet (redirect flow case)
      // Create a new payment record with the Razorpay details
      const paymentRef = adminDb.collection('payments').doc();
      const paymentId = paymentRef.id;

      paymentData = {
        id: paymentId,
        fileId,
        userId,
        amount: amount || 0, // Use provided amount or default to 0
        currency: 'INR',
        status: 'captured',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paymentMethod: 'razorpay',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          userAgent: request.headers.get('user-agent') || null,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        }
      };

      await paymentRef.set(paymentData);
      paymentDoc = { ref: paymentRef };
    } else {
      // Payment record exists (popup flow case)
      paymentDoc = paymentsSnapshot.docs[0];
      paymentData = paymentDoc.data();

      // Update payment status to captured
      await paymentDoc.ref.update({
        status: 'captured',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        updatedAt: new Date().toISOString(),
      });
    }

    // Update file status to paid and assign agent
    try {
      // Get all active agents for assignment
      const agentsSnapshot = await adminDb.collection('users')
        .where('role', '==', 'agent')
        .where('isActive', '==', true)
        .get();

      let assignedAgentId = null;
      
      if (!agentsSnapshot.empty) {
        // Simple round-robin assignment
        const agents = agentsSnapshot.docs;
        const randomIndex = Math.floor(Math.random() * agents.length);
        assignedAgentId = agents[randomIndex].id;
      }

      // Update file status and assign agent
      const fileUpdateData: any = {
        status: 'paid',
        updatedAt: new Date().toISOString()
      };

      if (assignedAgentId) {
        fileUpdateData.assignedAgentId = assignedAgentId;
        fileUpdateData.assignedAt = new Date().toISOString();
        fileUpdateData.assignmentType = 'automatic';
      }

      await adminDb.collection('files').doc(fileId).update(fileUpdateData);

      // Log the assignment
      if (assignedAgentId) {
        await adminDb.collection('logs').add({
          actionType: 'agent_assignment',
          actorId: 'system',
          actorType: 'system',
          fileId,
          targetUserId: assignedAgentId,
          details: {
            assignmentType: 'automatic',
            triggeredBy: 'payment_success'
          },
          timestamp: new Date()
        });
      }
    } catch (assignmentError) {
      // Don't fail the payment if assignment fails
      console.error('Agent assignment error:', assignmentError);
    }


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
    const amount = searchParams.get('amount');

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !fileId || !userId) {
      return NextResponse.json(
        { success: false, message: 'Missing required payment verification data' },
        { status: 400 }
      );
    }

    // Reuse POST logic by constructing a fake request body
    const verifyReq = new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature, 
        fileId, 
        userId,
        amount: amount ? parseFloat(amount) : undefined
      })
    });
    // Call POST verification internally
    const result = await POST(verifyReq as any);
    
    // For redirect flow, redirect to files page with success status
    if (result.status === 200) {
      const url = new URL(request.url);
      const redirectUrl = new URL('/files', url.origin);
      redirectUrl.searchParams.set('payment', 'success');
      return NextResponse.redirect(redirectUrl.toString());
    } else {
      const url = new URL(request.url);
      const redirectUrl = new URL('/files', url.origin);
      redirectUrl.searchParams.set('payment', 'failed');
      return NextResponse.redirect(redirectUrl.toString());
    }
  } catch (error: any) {
    console.error('GET verification error:', error);
    const url = new URL(request.url);
    const redirectUrl = new URL('/files', url.origin);
    redirectUrl.searchParams.set('payment', 'failed');
    return NextResponse.redirect(redirectUrl.toString());
  }
}