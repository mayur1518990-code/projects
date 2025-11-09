import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Validation functions
function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone } = body;

    if (process.env.NODE_ENV === 'development') {
      console.log('Login API received:', { name, phone: '***' });
    }

    // Validate input
    if (!name || !phone) {
      return NextResponse.json(
        { success: false, message: 'Name and phone number are required' },
        { status: 400 }
      );
    }

    // Validate phone format
    const cleanedPhone = phone.replace(/\s/g, '');
    if (!validatePhone(cleanedPhone)) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Search for user in Firestore by name and phone
    const usersSnapshot = await adminDb.collection('user')
      .where('name', '==', name.trim())
      .where('phone', '==', cleanedPhone)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'No account found with this name and phone number' },
        { status: 404 }
      );
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Return success response with user data
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        userId: userDoc.id,
        name: userData?.name || name.trim(),
        phone: userData?.phone || cleanedPhone,
        email: userData?.email || '', // Keep for backward compatibility
      },
      token: 'user-token', // Simple token for now
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Login error:', error);
    }

    // Generic error response
    return NextResponse.json(
      { success: false, message: 'Login failed. Please try again' },
      { status: 500 }
    );
  }
}

