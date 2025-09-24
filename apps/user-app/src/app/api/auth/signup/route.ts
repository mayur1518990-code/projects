import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
  // Remove all non-digit characters
  const cleanedPhone = phone.replace(/\D/g, '');
  // Check if it's a valid phone number (10-15 digits)
  return cleanedPhone.length >= 10 && cleanedPhone.length <= 15;
}

function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters long' };
  }
  return { isValid: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {

      console.log('API received body:', body);

    }
    const { name, email, phone, password, confirmPassword } = body;

    // Validate input
    if (process.env.NODE_ENV === 'development') {

      console.log('Validating fields:', {
      name: !!name,
      email: !!email,
      phone: !!phone,
      password: !!password,
      confirmPassword: !!confirmPassword,
    });

    }

    if (!name || !email || !phone || !password || !confirmPassword) {
      const missingFields = [];
      if (!name) missingFields.push('name');
      if (!email) missingFields.push('email');
      if (!phone) missingFields.push('phone');
      if (!password) missingFields.push('password');
      if (!confirmPassword) missingFields.push('confirmPassword');
      
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

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { success: false, message: passwordValidation.message },
        { status: 400 }
      );
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Check if user already exists in Firebase Auth
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json(
        { success: false, message: 'User with this email already exists' },
        { status: 409 }
      );
    } catch (error: any) {
      // User doesn't exist, continue with creation
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
    });

    // Store user details in Firestore
    const userData = {
      userId: userRecord.uid,
      name: name.trim(),
      email: email,
      phone: phone,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('user').doc(userRecord.uid).set(userData);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        userId: userRecord.uid,
        name: name.trim(),
        email: email,
        phone: phone,
      },
    });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {

      console.error('Signup error:', error);

    }

    // Handle Firebase Admin Auth errors
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { success: false, message: 'Email is already registered' },
        { status: 409 }
      );
    }

    if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { success: false, message: 'Password is too weak' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { success: false, message: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (error.code === 'auth/operation-not-allowed') {
      return NextResponse.json(
        { success: false, message: 'Email/password accounts are not enabled' },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { success: false, message: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
