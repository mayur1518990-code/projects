import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (process.env.NODE_ENV === 'development') {


      console.log('Login API received:', { email, password: '***' });


    }

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json(
          { success: false, message: 'No account found with this email' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Get user data from Firestore
    const userDoc = await adminDb.collection('user').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'User data not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Return success response with user data
    // Note: Password verification will be handled on the client side
    return NextResponse.json({
      success: true,
      message: 'User found, please verify password on client side',
      user: {
        userId: userRecord.uid,
        name: userData?.name || userRecord.displayName || userRecord.email?.split('@')[0] || 'User',
        email: userData?.email || userRecord.email,
        phone: userData?.phone || userRecord.phoneNumber || '',
      },
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {

      console.error('Login error:', error);

    }

    // Handle Firebase Auth errors
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { success: false, message: 'No account found with this email' },
        { status: 404 }
      );
    }

    if (error.code === 'auth/wrong-password') {
      return NextResponse.json(
        { success: false, message: 'Incorrect password' },
        { status: 401 }
      );
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { success: false, message: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/too-many-requests') {
      return NextResponse.json(
        { success: false, message: 'Too many failed attempts. Please try again later' },
        { status: 429 }
      );
    }

    if (error.code === 'auth/user-disabled') {
      return NextResponse.json(
        { success: false, message: 'This account has been disabled' },
        { status: 403 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { success: false, message: 'Login failed. Please try again' },
      { status: 500 }
    );
  }
}

