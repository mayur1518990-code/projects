import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, userId, amount } = body;

    console.log('Test payment request:', { fileId, userId, amount });

    // Test Firebase connection
    let firebaseStatus = 'unknown';
    try {
      await adminDb.collection('test').doc('connection').get();
      firebaseStatus = 'connected';
    } catch (error: any) {
      firebaseStatus = `error: ${error.message}`;
    }

    // Create a test payment record
    let paymentId = null;
    try {
      const paymentData = {
        fileId: fileId || 'test-file',
        userId: userId || 'test-user',
        amount: amount || 100,
        currency: 'INR',
        status: 'test',
        paymentMethod: 'test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          test: true,
          userAgent: request.headers.get('user-agent'),
          platform: 'mobile-app'
        }
      };

      const paymentRef = adminDb.collection('payments').doc();
      paymentId = paymentRef.id;

      await paymentRef.set({
        id: paymentId,
        ...paymentData,
      });

      console.log('Test payment created:', paymentId);
    } catch (error: any) {
      console.error('Test payment creation error:', error);
    }

    const response = {
      success: true,
      message: 'Test payment API is working',
      timestamp: new Date().toISOString(),
      firebaseStatus,
      paymentId,
      receivedData: body,
      request: {
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      }
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error: any) {
    console.error('Test payment error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Test payment failed', 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Test payment endpoint is accessible',
    timestamp: new Date().toISOString(),
    method: 'GET',
    url: request.url
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
