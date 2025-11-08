import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached } from '@/lib/cache';

const SETTINGS_DOC_ID = "contact-settings";

// GET - Fetch active contact numbers (public endpoint) with 5-minute caching
export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = 'contact_numbers';
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const settingsDoc = await adminDb.collection("settings").doc(SETTINGS_DOC_ID).get();
    
    let result;
    if (!settingsDoc.exists) {
      result = { 
        success: true,
        contactNumbers: [],
        isActive: false 
      };
    } else {
      const data = settingsDoc.data();
      const isActive = data?.isActive ?? false;
      const contactNumbers = data?.contactNumbers || [];

      // Only return contact numbers if feature is active
      result = { 
        success: true,
        contactNumbers: isActive ? contactNumbers : [],
        isActive
      };
    }

    // Cache for 24 hours (86400000ms) since contact numbers rarely change (months)
    setCached(cacheKey, result, 86400000);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching contact numbers:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch contact numbers",
        contactNumbers: [],
        isActive: false
      },
      { status: 500 }
    );
  }
}

