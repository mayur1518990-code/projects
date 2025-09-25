import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const healthCheck = {
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        firebase: 'checking...',
        database: 'checking...'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        platform: 'unknown'
      },
      request: {
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      }
    };

    // Check Firebase connection
    try {
      await adminDb.collection('health').doc('test').get();
      healthCheck.services.firebase = 'healthy';
      healthCheck.services.database = 'healthy';
    } catch (firebaseError: any) {
      healthCheck.services.firebase = 'error';
      healthCheck.services.database = 'error';
      healthCheck.error = firebaseError.message;
    }

    // Detect platform
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('appxyz')) {
      healthCheck.environment.platform = 'appxyz';
    } else if (userAgent.includes('Android')) {
      healthCheck.environment.platform = 'android';
    } else if (userAgent.includes('iPhone')) {
      healthCheck.environment.platform = 'ios';
    } else {
      healthCheck.environment.platform = 'web';
    }

    console.log('Health check:', healthCheck);

    return NextResponse.json(healthCheck, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Health check failed', 
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
