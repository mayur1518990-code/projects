import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached } from '@/lib/cache';
import crypto from 'crypto';

const SETTINGS_DOC_ID = "contact-settings";

// Helper function to calculate checksum from contact numbers
function calculateChecksum(contactNumbers: string[], isActive: boolean): string {
  const data = `${isActive ? 'active' : 'inactive'}:${contactNumbers.sort().join('|')}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

// Helper function to fetch contact numbers from Firestore
async function fetchContactNumbersFromFirestore() {
  const settingsDoc = await adminDb.collection("settings").doc(SETTINGS_DOC_ID).get();
  
  if (!settingsDoc.exists) {
    return { contactNumbers: [], isActive: false, updatedAt: null };
  }
  
  const data = settingsDoc.data();
  const isActive = data?.isActive ?? false;
  const contactNumbers = data?.contactNumbers || [];
  const updatedAt = data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt || null;

  return {
    contactNumbers: isActive ? contactNumbers : [],
    isActive,
    updatedAt
  };
}

// GET - Fetch active contact numbers with version/checksum support
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const checkVersion = url.searchParams.get('version') === 'true';
    
    // If only checking version, return lightweight checksum
    if (checkVersion) {
      // Always fetch fresh from Firestore to detect changes immediately
      const data = await fetchContactNumbersFromFirestore();
      const checksum = calculateChecksum(data.contactNumbers, data.isActive);
      
      return NextResponse.json(
        { checksum },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Full contact numbers fetch
    const cacheKey = 'contact_numbers';
    const cached = getCached<{ contactNumbers: string[]; isActive: boolean; checksum: string; timestamp?: number }>(cacheKey);
    
    // Only use cache if it's very fresh (< 5 seconds) to allow quick updates
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < 5000)) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const data = await fetchContactNumbersFromFirestore();
    const checksum = calculateChecksum(data.contactNumbers, data.isActive);

    const result = { 
      success: true,
      contactNumbers: data.contactNumbers,
      isActive: data.isActive,
      checksum,
      timestamp: Date.now()
    };
    
    // Cache for only 5 seconds - contact numbers can be updated by admin
    setCached(cacheKey, result, 5000);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
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

