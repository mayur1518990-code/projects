import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Validation functions
function validatePhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  const cleanedPhone = phone.replace(/\s/g, '');
  return phoneRegex.test(cleanedPhone);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('API received body:', body);
    }
    const { name, phone } = body;

    // Validate input
    if (process.env.NODE_ENV === 'development') {
      console.log('Validating fields:', {
        name: !!name,
        phone: !!phone,
      });
    }

    if (!name || !phone) {
      const missingFields = [];
      if (!name) missingFields.push('name');
      if (!phone) missingFields.push('phone');
      
      return NextResponse.json(
        { success: false, message: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate name
    if (!name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Name cannot be empty' },
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

    // Check if user already exists (by name and phone combination)
    const existingUsersSnapshot = await adminDb.collection('user')
      .where('name', '==', name.trim())
      .where('phone', '==', cleanedPhone)
      .limit(1)
      .get();

    if (!existingUsersSnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'User with this name and phone number already exists' },
        { status: 409 }
      );
    }

    // Create user document in Firestore (no Firebase Auth needed)
    const userData = {
      name: name.trim(),
      phone: cleanedPhone,
      createdAt: new Date().toISOString(),
      email: '', // Keep for backward compatibility
    };

    // Generate a unique ID for the user
    const userRef = adminDb.collection('user').doc();
    await userRef.set({
      ...userData,
      userId: userRef.id,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        userId: userRef.id,
        name: name.trim(),
        phone: cleanedPhone,
        email: '', // Keep for backward compatibility
      },
      token: 'user-token', // Simple token for now
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Signup error:', error);
    }

    // Generic error response
    return NextResponse.json(
      { success: false, message: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
