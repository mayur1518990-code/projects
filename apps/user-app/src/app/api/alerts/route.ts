import { NextResponse } from "next/server";
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached } from '@/lib/cache';

// GET - Fetch active alerts with 5-minute caching
export async function GET() {
  try {
    // Check cache first
    const cacheKey = 'active_alerts';
    const cached = getCached(cacheKey);
    if (cached) {
      // Return cached response with HTTP cache headers
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

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
    
    const alerts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        message: data.message,
        type: data.type,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });

    const result = { alerts };
    
    // Cache for 5 minutes (300000ms) since alerts don't change frequently
    setCached(cacheKey, result, 300000);

    // Return with HTTP cache headers for CDN/browser caching
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
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

