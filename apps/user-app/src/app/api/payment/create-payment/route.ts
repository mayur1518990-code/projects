import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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


    const paymentRef = adminDb.collection('payments').doc();
    const paymentId = paymentRef.id;

    const paymentDocument = {
      id: paymentId,
      ...paymentData,
    };

    
    try {
      await paymentRef.set(paymentDocument);
    } catch (firestoreError) {
      throw firestoreError;
    }

    // Update file status to "paid" and assign agent
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
    }

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      message: 'Payment created successfully'
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'An error occurred while creating payment' },
      { status: 500 }
    );
  }
}
