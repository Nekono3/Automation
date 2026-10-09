'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InboxFoldersPane, InboxViewType } from '@/components/InboxFoldersPane';
import { ConversationList } from '@/components/ConversationList';
import { ChatPanel } from '@/components/ChatPanel';
import { CustomerInspector } from '@/components/CustomerInspector';
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
  const [activeView, setActiveView] = useState<InboxViewType>('inbox');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Ref to track current selectedId in background polling without triggering interval restarts
  const selectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Load details (messages & bookings) for a specific conversation
  const loadConversationDetails = useCallback(async (id: string, silent = false) => {
    try {
      const msgs = await api.getMessages(id, 0, 100);
      setMessages((prev) => {
        // Avoid state updates if messages haven't changed (prevents flicker)
        if (
          prev.length === msgs.length &&
          prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id &&
          prev[prev.length - 1]?.text === msgs[msgs.length - 1]?.text
        ) {
          return prev;
        }
        return msgs;
      });

      if (!silent) {
        const conv = conversations.find((c) => String(c.id) === String(id));
        const customerId = conv?.customer_id;
        if (customerId) {
          const b = await api.getBookings({ customer_id: customerId });
          setBookings(b);
        }
      }
    } catch (err) {
      console.error('Error loading conversation details:', err);
    }
  }, [conversations]);

  // Unified background polling: syncs conversation list AND active conversation messages
  const syncData = useCallback(async () => {
    try {
      const data = await api.getConversations();
      
      setConversations((prev) => {
        const lower = searchQuery.toLowerCase();
        const filtered = searchQuery
          ? data.filter(
              (c) =>
                c.customer?.name?.toLowerCase().includes(lower) ||
                c.customer?.username?.toLowerCase().includes(lower) ||
                String(c.customer_id).includes(lower)
            )
          : data;

        // Check if anything actually changed in conversations
        const isSame =
          prev.length === filtered.length &&
          prev.every(
            (p, idx) =>
              p.id === filtered[idx]?.id &&
              p.last_message_at === filtered[idx]?.last_message_at &&
              p.unread_count === filtered[idx]?.unread_count &&
              p.mode === filtered[idx]?.mode
          );

        return isSame ? prev : filtered;
      });

      // Handle initial auto-selection
      const currentSelected = selectedIdRef.current;
      if (targetCustomerId) {
        const matched = data.find((c) => String(c.customer_id) === String(targetCustomerId));
        if (matched && matched.id !== currentSelected) {
          setSelectedId(matched.id);
        }
      } else if (!currentSelected && data.length > 0) {
        setSelectedId(data[0].id);
      }

      // Live-poll messages for the currently open conversation
      if (currentSelected) {
        loadConversationDetails(currentSelected, true);
      }
    } catch (err) {
      console.error('Sync error:', err);
    }
  }, [searchQuery, targetCustomerId, loadConversationDetails]);

  // Initial load and periodic background sync every 2.5 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    syncData();
    const interval = setInterval(syncData, 2500);
    return () => clearInterval(interval);
  }, [isAuthenticated, syncData]);

  // When user actively clicks / changes conversation
  useEffect(() => {
    if (selectedId) {
      loadConversationDetails(selectedId, false);
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

  // Filter conversations by active view
  const viewFilteredConversations = conversations.filter((c) => {
    if (activeView === 'inbox') return c.status === 'open';
    if (activeView === 'unassigned') return !c.assigned_user_id;
    if (activeView === 'mentions' || activeView === 'created_by_you') return false;
    return true;
  });

  const selectedConversation = conversations.find((c) => String(c.id) === String(selectedId));

  const totalCount = conversations.length;
  const openCount = conversations.filter((c) => c.status === 'open').length;
  const aiCount = conversations.filter((c) => c.mode === 'ai' && c.status === 'open').length;

  return (
    <div className="flex h-full w-full overflow-hidden p-2.5 gap-2.5 bg-[#F8FAFC]">
      {/* Pane 1: Inbox Views & Navigation */}
      <InboxFoldersPane
        totalCount={totalCount}
        openCount={openCount}
        aiCount={aiCount}
        activeView={activeView}
        onViewChange={setActiveView}
        onSearchClick={() => {}}
      />

      {/* Pane 2: Conversation List Column */}
      <ConversationList
        conversations={viewFilteredConversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
      
      {/* Pane 3: Center Messenger Stream */}
      {selectedConversation ? (
        <>
          <ChatPanel
            conversation={selectedConversation}
            messages={messages}
            onModeChange={handleModeChange}
            onMessageSent={() => selectedId && loadConversationDetails(selectedId)}
          />

          {/* Pane 4: Right Inspector Panel (Details & Copilot) */}
          {selectedConversation.customer && (
            <CustomerInspector
              customer={selectedConversation.customer}
              bookings={bookings}
              onConfirmBooking={handleConfirmBooking}
              onCancelBooking={handleCancelBooking}
            />
          )}
        </>
      ) : (
        <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-slate-500 font-sans text-xs shadow-sm">
          <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
          <p className="font-bold text-slate-800 text-sm">Выберите диалог из списка</p>
          <p className="text-slate-500 mt-1">Сообщения Instagram Direct отобразятся здесь</p>
        </div>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500 font-mono text-xs">Загрузка Intercom Desk...</div>}>
      <ConversationsContent />
    </Suspense>
  );
}
