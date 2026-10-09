'use client';

import { Customer, Booking } from '@/lib/types';
import { CustomerInspector } from './CustomerInspector';

interface Props {
  customer: Customer;
  bookings: Booking[];
  onConfirmBooking: (id: string) => void;
  onCancelBooking: (id: string) => void;
  onInsertReplyDraft?: (text: string) => void;
  onClose?: () => void;
}

export function CustomerPanel(props: Props) {
  return <CustomerInspector {...props} />;
}
