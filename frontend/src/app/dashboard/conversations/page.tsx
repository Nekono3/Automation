'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationList } from '@/components/ConversationList';
import { ChatPanel } from '@/components/ChatPanel';
import { CustomerPanel } from '@/components/CustomerPanel';
import { api } from '@/lib/api';
import { Conversation, Message, Booking } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare } from 'lucide-react';

function ConversationsContent() {
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const targetCustomerId = searchParams.get('customer_id');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        setConversations(
          data.filter(
            (c) =>
              c.customer?.name?.toLowerCase().includes(lower) ||
              c.customer?.username?.toLowerCase().includes(lower) ||
              String(c.customer_id).includes(lower)
          )
        );
      } else {
        setConversations(data);
      }

      // If a target customer was requested via URL, auto-select their conversation
      if (targetCustomerId) {
        const matched = data.find((c) => String(c.customer_id) === String(targetCustomerId));
        if (matched) {
          setSelectedId(matched.id);
        }
      } else if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, [searchQuery, targetCustomerId, selectedId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchConversations]);

  const loadConversationDetails = async (id: string) => {
    try {
      const msgs = await api.getMessages(id, 0, 100);
      // Backend already returns messages ordered by created_at.asc()
      setMessages(msgs);

      const conv = conversations.find((c) => String(c.id) === String(id));
      if (!conv) {
        const c = await api.getConversation(id);
        if (c.customer_id) {
          const b = await api.getBookings({ customer_id: c.customer_id });
          setBookings(b);
        }
      } else if (conv.customer_id) {
        const b = await api.getBookings({ customer_id: conv.customer_id });
        setBookings(b);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedId) {
      loadConversationDetails(selectedId);
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(selectedId) ? { ...c, unread_count: 0 } : c))
      );
    } else {
      setMessages([]);
      setBookings([]);
    }
  }, [selectedId]);

  const handleModeChange = async (mode: 'ai' | 'human' | 'paused') => {
    if (!selectedId) return;
    try {
      await api.updateConversationMode(selectedId, mode);
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(selectedId) ? { ...c, mode } : c))
      );
    } catch (err) {
      console.error('Failed to change mode', err);
    }
  };

  const handleConfirmBooking = async (id: string) => {
    try {
      await api.confirmBooking(id);
      if (selectedId) loadConversationDetails(selectedId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelBooking = async (id: string) => {
    try {
      await api.cancelBooking(id, 'Отменено оператором');
      if (selectedId) loadConversationDetails(selectedId);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedConversation = conversations.find((c) => String(c.id) === String(selectedId));

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#070b14]">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      {selectedConversation ? (
        <>
          <ChatPanel
            conversation={selectedConversation}
            messages={messages}
            onModeChange={handleModeChange}
            onMessageSent={() => selectedId && loadConversationDetails(selectedId)}
          />
          {selectedConversation.customer && (
            <CustomerPanel
              customer={selectedConversation.customer}
              bookings={bookings}
              onConfirmBooking={handleConfirmBooking}
              onCancelBooking={handleCancelBooking}
            />
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-[#070b14] font-mono text-sm">
          <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
          <p>Выберите диалог из списка слева для просмотра</p>
        </div>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Загрузка диалогов...</div>}>
      <ConversationsContent />
    </Suspense>
  );
}
