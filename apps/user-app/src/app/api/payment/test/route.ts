import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  return NextResponse.json({
    success: true,
    message: 'Payment test endpoint working',
    timestamp: new Date().toISOString(),
    params: Object.fromEntries(searchParams.entries()),
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer')
  });
}
