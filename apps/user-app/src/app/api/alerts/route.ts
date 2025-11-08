import { NextRequest, NextResponse } from "next/server";
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached } from '@/lib/cache';
import crypto from 'crypto';

// Helper function to calculate checksum from alerts
function calculateChecksum(alerts: any[]): string {
  const data = alerts
    .map(a => `${a.id}:${a.updatedAt || a.createdAt}`)
    .sort()
    .join('|');
  return crypto.createHash('md5').update(data).digest('hex');
}

// Helper function to fetch alerts from Firestore
async function fetchAlertsFromFirestore() {
  const alertsRef = adminDb.collection("alerts");
  
  // Optimized query: Only fetch active alerts (requires Firestore index)
  // If index doesn't exist, will fall back to fetch all
  let snapshot;
  try {
    snapshot = await alertsRef
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc")
      .limit(10) // Only get last 10 alerts
      .get();
  } catch (indexError) {
    // Fallback: fetch all and filter in memory if index doesn't exist
    console.log("Firestore index not found, using fallback query");
    const allSnapshot = await alertsRef.get();
    const filteredDocs = allSnapshot.docs
      .filter(doc => doc.data().isActive === true)
      .slice(0, 10);
    
    snapshot = {
      docs: filteredDocs,
      empty: filteredDocs.length === 0
    };
  }
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      message: data.message,
      type: data.type,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    };
  });
}

// GET - Fetch active alerts with version/checksum support
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const checkVersion = url.searchParams.get('version') === 'true';
    
    // If only checking version, return lightweight checksum
    if (checkVersion) {
      // Always fetch fresh from Firestore to detect changes immediately
      // No caching on version endpoint - we want instant change detection
      const alerts = await fetchAlertsFromFirestore();
      const checksum = calculateChecksum(alerts);
      
      return NextResponse.json(
        { checksum },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Full alerts fetch
    const cacheKey = 'active_alerts';
    const cached = getCached<{ alerts: any[]; checksum: string; timestamp?: number }>(cacheKey);
    
    // Only use cache if it's very fresh (< 5 seconds) to allow quick updates
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < 5000)) {
      // Return cached response with shorter HTTP cache headers
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const alerts = await fetchAlertsFromFirestore();
    const checksum = calculateChecksum(alerts);

    const result = { 
      alerts,
      checksum, // Include checksum in response
      timestamp: Date.now() // Add timestamp for cache freshness check
    };
    
    // Cache for only 5 seconds - alerts can be deleted/updated by admin
    setCached(cacheKey, result, 5000);

    // Return with shorter HTTP cache headers for faster updates
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}



