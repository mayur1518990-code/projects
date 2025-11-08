import { NextRequest, NextResponse } from "next/server";
import { adminDb } from '@/lib/firebase-admin';
import { getCached, setCached, deleteCached } from '@/lib/cache';
import { createHash } from 'crypto';

// Generate content hash from alerts to detect actual changes
function generateContentHash(alerts: any[]): string {
  // Sort alerts by id for consistent hashing
  const sorted = alerts
    .map(a => ({
      id: a.id,
      message: a.message,
      type: a.type,
      isActive: a.isActive
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  
  const content = JSON.stringify(sorted);
  return createHash('md5').update(content).digest('hex');
}

// GET - Fetch active alerts with efficient content-based polling
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const providedHash = url.searchParams.get('contentHash');
    const checkOnly = url.searchParams.get('checkOnly') === 'true';
    
    // If checkOnly is true, just return the content hash to check if alerts changed
    if (checkOnly) {
      const alertsRef = adminDb.collection("alerts");
      let snapshot;
      
      try {
        snapshot = await alertsRef
          .where("isActive", "==", true)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      } catch (indexError) {
        // Fallback: fetch all and filter
        const allSnapshot = await alertsRef.get();
        const filteredDocs = allSnapshot.docs
          .filter(doc => doc.data().isActive === true)
          .slice(0, 10);
        
        snapshot = {
          docs: filteredDocs,
          empty: filteredDocs.length === 0
        };
      }
      
      // Get active alerts
      const activeAlerts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          message: data.message,
          type: data.type,
          isActive: data.isActive
        };
      });
      
      // Generate content hash
      const currentHash = generateContentHash(activeAlerts);
      
      // Compare with provided hash
      const hasChanged = providedHash ? currentHash !== providedHash : true;
      
      return NextResponse.json({ 
        contentHash: currentHash,
        hasUpdate: hasChanged
      });
    }
    
    // If providedHash is provided and matches cached, return 304 Not Modified
    if (providedHash) {
      const cacheKey = 'active_alerts_hash';
      const cachedHash = getCached<string>(cacheKey);
      
      if (cachedHash && cachedHash === providedHash) {
        return new NextResponse(null, { status: 304 });
      }
    }
    
    // Check cache first
    const cacheKey = 'active_alerts';
    const cached = getCached(cacheKey);
    if (cached && !providedHash) {
      // Return cached response with shorter HTTP cache headers
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
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

    // Generate content hash for change detection
    const generatedHash = generateContentHash(
      alerts.map(a => ({ id: a.id, message: a.message, type: a.type, isActive: true }))
    );

    const result = { 
      alerts,
      contentHash: generatedHash
    };
    
    // Cache for 5 seconds only - alerts can be deleted/updated by admin frequently
    setCached(cacheKey, result, 5000);
    setCached('active_alerts_hash', generatedHash, 5000);

    // Return with shorter HTTP cache headers for faster updates
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
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

// Clear cache when called (used by admin when updating alerts)
export async function DELETE() {
  try {
    deleteCached('active_alerts');
    deleteCached('active_alerts_hash');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing alert cache:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}

