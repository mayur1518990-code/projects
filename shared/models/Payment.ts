export interface Payment {
  id: string;
  fileId: string;
  userId: string;
  amount: number; // Amount in rupees
  currency: string;
  status: 'pending' | 'captured' | 'failed' | 'refunded';
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    [key: string]: any;
  };
}

export interface CreatePaymentData {
  fileId: string;
  userId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  paymentMethod: string;
  metadata?: any;
}

export interface UpdatePaymentData {
  status: Payment['status'];
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  updatedAt: string;
}