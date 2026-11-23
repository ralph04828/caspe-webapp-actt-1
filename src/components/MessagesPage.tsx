import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  Flag,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  PhoneOff,
  Reply,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { ChatConversation, ChatMessage, UserProfile } from '../types';
import {
  deleteConversationMessageFirestore,
  getConversationDoc,
  loadOlderConversationMessages,
  sendConversationMessageFirestore,
  setConversationTypingFirestore,
  subscribeConversationMessages,
} from '../services/firestoreService';
import { uploadImageAsset } from '../services/storageService';
import {
  checkMessageRateLimit,
  checkTextSafety,
  formatRelativeTime,
  formatTimeClock,
  isUserRecentlyOnline,
} from '../utils/formatters';
import { AvatarImage } from './AvatarImage';
import { GarmentImage } from './GarmentImage';
import { PhotoPickerButton } from './PhotoPickerButton';
import { cleanData } from '../utils/cleanData';

interface MessagesPageProps {
  initialConversationId?: string | null;
  onClearInitialConversation?: () => void;
  onOpenProfile: (uid: string) => void;
  onNavigatePeople: () => void;
}

const CHAT_RULES_KEY_PREFIX = 'swooosh_chat_rules_ack_';
const QUICK_EMOJIS = ['🔥', '🖤', '👟', '✨', '💯', '🙌'];

export const MessagesPage: React.FC<MessagesPageProps> = ({
  initialConversationId,
  onClearInitialConversation,
  onOpenProfile,
  onNavigatePeople,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const {
    conversations,
    friendIds,
    discoverProfiles,
    demoMessagesByConv,
    setDemoMessagesForConv,
    startDmWithFriend,
    createGroupChat,
    updateGroupChat,
    leaveConversation,
    markConvRead,
    toggleBlock,
    toggleMute,
    reportItem,
    isBlocked,
    isMuted,
  } = useSocial();

  const [rulesAccepted, setRulesAccepted] = useState<boolean>(() => {
    if (!userProfile) return true;
    return localStorage.getItem(`${CHAT_RULES_KEY_PREFIX}${userProfile.uid}`) === 'true';
  });

  useEffect(() => {
    if (userProfile) {
      setRulesAccepted(
        localStorage.getItem(`${CHAT_RULES_KEY_PREFIX}${userProfile.uid}`) === 'true'
      );
    }
  }, [userProfile?.uid]);

  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);

  useEffect(() => {
    if (initialConversationId) {
      setActiveConvId(initialConversationId);
      onClearInitialConversation?.();
    }
  }, [initialConversationId, onClearInitialConversation]);

  // Real-time messages state (detached cleanly on unmount or switch)
  const [convMessages, setConvMessages] = useState<ChatMessage[]>([]);
  const [convOldestDoc, setConvOldestDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingOlderConv, setLoadingOlderConv] = useState(false);

  const [chatError, setChatError] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    senderUsername: string;
    text: string;
  } | null>(null);
  const [stagedImage, setStagedImage] = useState<{
    imageUrl: string;
    thumbUrl: string;
    mediaId: string;
    altText: string;
  } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sending, setSending] = useState(false);

  // Modals / Popovers
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showConvMenu, setShowConvMenu] = useState(false);

  // Group form fields
  const [groupName, setGroupName] = useState('');
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [groupPhotoDraft, setGroupPhotoDraft] = useState<{
    photoUrl: string;
    mediaId: string;
  } | null>(null);
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false);
  const [groupRenameValue, setGroupRenameValue] = useState('');

  const lastTypingSentRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const friendProfiles = useMemo(
    () => discoverProfiles.filter((p) => friendIds.includes(p.uid)),
    [discoverProfiles, friendIds]
  );

  const [verifiedConv, setVerifiedConv] = useState<ChatConversation | null>(null);

  const activeConv: ChatConversation | undefined = useMemo(
    () =>
      conversations.find((c) => c.id === activeConvId) ||
      (verifiedConv?.id === activeConvId ? verifiedConv : undefined),
    [conversations, verifiedConv, activeConvId]
  );

  // Subscribe to active DM/Group messages (latest 30) only once membership doc exists
  useEffect(() => {
    setChatError(null);
    setConvOldestDoc(null);
    if (!activeConvId || !userProfile) {
      setConvMessages([]);
      return;
    }
    if (isDemoMode) {
      setConvMessages(demoMessagesByConv[activeConvId] || []);
      markConvRead(activeConvId);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;

    const attach = async () => {
      const known =
        conversations.find((c) => c.id === activeConvId) ||
        (verifiedConv?.id === activeConvId ? verifiedConv : null);

      let resolvedConv = known;
      if (!resolvedConv) {
        resolvedConv = await getConversationDoc(activeConvId);
        if (cancelled) return;
        if (resolvedConv) {
          setVerifiedConv(resolvedConv);
        }
      }

      if (!resolvedConv) {
        setConvMessages([]);
        return;
      }

      markConvRead(activeConvId);
      unsub = subscribeConversationMessages(
        activeConvId,
        30,
        (msgs, oldest) => {
          setConvMessages(msgs);
          setConvOldestDoc(oldest);
          markConvRead(activeConvId);
        },
        (err) => {
          console.error('Messages subscription failed:', err);
          const msg = err?.message || '';
          setChatError(
            msg.toLowerCase().includes('quota')
              ? 'Daily Spark plan limit reached. Try again later.'
              : msg || 'Could not load messages for this chat.'
          );
        }
      );
    };

    attach();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [activeConvId, userProfile?.uid, isDemoMode, Boolean(conversations.find((c) => c.id === activeConvId))]);

  useEffect(() => {
    if (isDemoMode && activeConvId) {
      setConvMessages(demoMessagesByConv[activeConvId] || []);
    }
  }, [demoMessagesByConv, activeConvId, isDemoMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  if (!userProfile) return null;

  const acceptRules = () => {
    localStorage.setItem(`${CHAT_RULES_KEY_PREFIX}${userProfile.uid}`, 'true');
    setRulesAccepted(true);
  };

  const getConvDisplay = (conv: ChatConversation) => {
    if (conv.type === 'group') {
      return {
        name: conv.name || 'Group Chat',
        subtitle: `${conv.participantIds.length} members`,
        photoUrl: conv.photoUrl,
        mediaId: conv.mediaId,
        peerProfile: undefined as UserProfile | undefined,
      };
    }
    const otherId = conv.participantIds.find((id) => id !== userProfile.uid) || userProfile.uid;
    const part = conv.participantProfiles[otherId];
    const discovered = discoverProfiles.find((p) => p.uid === otherId);
    const isOnline =
      discovered?.showOnlineStatus !== false &&
      isUserRecentlyOnline(discovered?.onlineStatus, discovered?.lastSeenAt);
    const subtitle =
      discovered?.showOnlineStatus !== false
        ? isOnline
          ? 'Online'
          : discovered?.lastSeenAt
          ? `Last seen ${formatRelativeTime(discovered.lastSeenAt)}`
          : `@${part?.username || 'member'}`
        : `@${part?.username || 'member'}`;

    return {
      name: part?.displayName || discovered?.displayName || 'SWOOOSH Member',
      subtitle,
      photoUrl: part?.photoUrl || discovered?.photoURL,
      mediaId: part?.mediaId || discovered?.mediaId,
      peerProfile: discovered,
      otherId,
      isOnline,
    };
  };

  const handleLoadOlderConv = async () => {
    if (!activeConvId || !convOldestDoc || loadingOlderConv) return;
    setLoadingOlderConv(true);
    try {
      const older = await loadOlderConversationMessages(activeConvId, convOldestDoc, 30);
      setConvMessages((prev) => [...older.messages, ...prev]);
      setConvOldestDoc(older.oldestDoc);
    } finally {
      setLoadingOlderConv(false);
    }
  };

  const handleStageImageFile = async (file: File) => {
    if (!activeConv) return;
    setChatError(null);
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadImageAsset(file, userProfile.uid, 'friends', isDemoMode, {
        conversationId: activeConv.id,
      });
      setStagedImage({
        imageUrl: uploaded.imageUrl,
        thumbUrl: uploaded.thumbUrl,
        mediaId: uploaded.mediaId,
        altText: '',
      });
    } catch (err: any) {
      const msg = err?.message || 'Could not upload image.';
      console.error('Chat image upload failed:', err);
      setChatError(msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUploadNewGroupPhotoFile = async (file: File, existingConvId?: string) => {
    setUploadingGroupPhoto(true);
    setChatError(null);
    try {
      const uploaded = await uploadImageAsset(
        file,
        userProfile.uid,
        'friends',
        isDemoMode,
        existingConvId ? { conversationId: existingConvId } : undefined
      );
      if (existingConvId) {
        await updateGroupChat(existingConvId, {
          photoUrl: uploaded.thumbUrl,
          mediaId: uploaded.mediaId,
        });
      } else {
        setGroupPhotoDraft({ photoUrl: uploaded.thumbUrl, mediaId: uploaded.mediaId });
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not upload group photo.';
      console.error('Group photo upload failed:', err);
      setChatError(msg);
    } finally {
      setUploadingGroupPhoto(false);
    }
  };

  const handleDraftChange = (val: string) => {
    setDraftText(val);
    if (activeConv && !isDemoMode) {
      const now = Date.now();
      if (val.trim() && now - lastTypingSentRef.current > 2500) {
        lastTypingSentRef.current = now;
        setConversationTypingFirestore(activeConv.id, userProfile.uid, true);
      } else if (!val.trim()) {
        setConversationTypingFirestore(activeConv.id, userProfile.uid, false);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv) return;
    const trimmed = draftText.trim();
    if (!trimmed && !stagedImage) return;
    setChatError(null);

    if (trimmed) {
      const safety = checkTextSafety(trimmed, 1000);
      if (!safety.ok) {
        setChatError(safety.reason || 'Message blocked by safety rules.');
        return;
      }
    }
    const rate = checkMessageRateLimit(userProfile.uid, 20);
    if (!rate.ok) {
      setChatError(rate.reason || 'Rate limit reached.');
      return;
    }

    setSending(true);
    try {
      const now = new Date().toISOString();
      const msg: ChatMessage = cleanData({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        conversationId: activeConv.id,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderUsername: userProfile.username,
        senderPhotoUrl: userProfile.photoURL,
        text: trimmed,
        ...(stagedImage
          ? {
              imageUrl: stagedImage.imageUrl,
              thumbUrl: stagedImage.thumbUrl,
              mediaId: stagedImage.mediaId,
              altText: stagedImage.altText.trim() || 'Shared photo in chat',
            }
          : {}),
        ...(replyingTo ? { replyTo: replyingTo } : {}),
        createdAt: now,
      });
      if (isDemoMode) {
        setDemoMessagesForConv(activeConv.id, (prev) => [...prev, msg]);
      } else {
        await sendConversationMessageFirestore(activeConv, msg);
      }

      setDraftText('');
      setReplyingTo(null);
      setStagedImage(null);
    } catch (err: any) {
      setChatError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleStartDm = async (target: UserProfile) => {
    setChatError(null);
    try {
      const conv = await startDmWithFriend(target);
      setVerifiedConv(conv);
      setShowNewDm(false);
      setActiveConvId(conv.id);
    } catch (err: any) {
      const msg = err?.message || 'Could not start DM.';
      console.error('Start DM failed:', err);
      setChatError(msg);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setChatError(null);
    try {
      const chosen = friendProfiles.filter((f) => groupSelectedIds.includes(f.uid));
      const conv = await createGroupChat({
        name: groupName,
        memberProfiles: chosen,
        ...(groupPhotoDraft ? { photoUrl: groupPhotoDraft.photoUrl, mediaId: groupPhotoDraft.mediaId } : {}),
      });
      setGroupName('');
      setGroupSelectedIds([]);
      setGroupPhotoDraft(null);
      setShowNewGroup(false);
      setActiveConvId(conv.id);
    } catch (err: any) {
      setChatError(err?.message || 'Could not create group.');
    }
  };

  const typingUsersText = useMemo(() => {
    if (!activeConv?.typingBy) return null;
    const now = Date.now();
    const names: string[] = [];
    Object.entries(activeConv.typingBy).forEach(([uid, ts]) => {
      if (uid !== userProfile.uid && ts) {
        const diff = now - new Date(ts).getTime();
        if (!Number.isNaN(diff) && diff < 6000) {
          const p = activeConv.participantProfiles[uid];
          names.push(p?.displayName || p?.username || 'Someone');
        }
      }
    });
    if (names.length === 0) return null;
    return `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing...`;
  }, [activeConv?.typingBy, userProfile.uid]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* First-time Chat Community Safety Guidelines */}
      {!rulesAccepted && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-rules-title"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-modal p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-[#171717] dark:text-[#e5e1da]" />
              <h2 id="chat-rules-title" className="text-lg font-display font-bold text-[#171717] dark:text-[#e5e1da]">
                SWOOOSH Chat Guidelines
              </h2>
            </div>
            <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0] leading-relaxed">
              Keep SWOOOSH a creative, respectful fashion community:
            </p>
            <ul className="text-xs text-[#171717] dark:text-[#e5e1da] space-y-1.5 list-disc pl-4">
              <li>No harassment, hate speech, body-shaming, or non-consensual photos.</li>
              <li>Direct Messages and friend groups are friends-only. Use Block, Mute, or Report anytime.</li>
              <li>No spam, suspicious links, or commercial storefront solicitation.</li>
            </ul>
            <button
              type="button"
              onClick={acceptRules}
              className="w-full py-2.5 min-h-[44px] rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
            >
              I Agree — Open Messages
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-modal overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[74vh] max-h-[82vh]">
        {/* Left Conversation List */}
        <aside
          className={`md:col-span-4 border-r border-[#d4cfc5] dark:border-[#404040] flex flex-col min-h-0 ${
            activeConv ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-[#d4cfc5] dark:border-[#404040] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-display font-bold text-[#171717] dark:text-[#e5e1da]">
                Messages
              </h2>
              <span
                title="Voice and video calls are planned for a future update"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip border border-[#d4cfc5] dark:border-[#404040] text-[10px] text-[#4e4c46] dark:text-[#b0b0b0] opacity-75 select-none"
              >
                <PhoneOff className="w-3 h-3" />
                <span>Calls (coming later)</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowNewDm(true)}
                className="inline-flex items-center justify-center gap-1.5 py-2 min-h-[42px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold text-[#171717] dark:text-[#e5e1da] hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>New DM</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewGroup(true)}
                className="inline-flex items-center justify-center gap-1.5 py-2 min-h-[42px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold text-[#171717] dark:text-[#e5e1da] hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>New Group</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {friendProfiles.length > 0 && (
              <div className="pb-2 mb-2 border-b border-[#d4cfc5]/70 dark:border-[#404040]/70">
                <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#b0b0b0]">
                  Friends — Start a chat
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {friendProfiles.map((f) => (
                    <button
                      key={f.uid}
                      type="button"
                      onClick={() => handleStartDm(f)}
                      title={`Message @${f.username}`}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-control hover:bg-[#f5f4f0] dark:hover:bg-[#2c2c2c] shrink-0 max-w-[68px] cursor-pointer"
                    >
                      <AvatarImage
                        src={f.photoURL}
                        mediaId={f.mediaId}
                        name={f.displayName}
                        sizeClass="w-9 h-9"
                        textSizeClass="text-xs"
                      />
                      <span className="text-[10px] font-medium truncate w-full text-center">
                        {(f.displayName || f.username).split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatError && !activeConv && (
              <div
                role="alert"
                className="p-2.5 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-[11px]"
              >
                {chatError}
              </div>
            )}

            {conversations.length === 0 ? (
              <div className="p-4 text-center space-y-2.5">
                <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
                  {friendProfiles.length > 0
                    ? 'Tap a friend above or "New DM" to start messaging.'
                    : 'No conversations yet. Add friends to message them directly or start a friend group chat.'}
                </p>
                {friendProfiles.length === 0 && (
                  <button
                    type="button"
                    onClick={onNavigatePeople}
                    className="px-3.5 py-2 min-h-[40px] rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
                  >
                    Find Friends
                  </button>
                )}
              </div>
            ) : (
              conversations.map((conv) => {
                const info = getConvDisplay(conv);
                const unread = conv.unreadBy?.[userProfile.uid] || 0;
                const active = activeConvId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setShowConvMenu(false);
                      setActiveConvId(conv.id);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 min-h-[56px] rounded-card text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#eae7e0] dark:bg-[#303030] border border-[#171717]/20 dark:border-[#e5e1da]/25'
                        : 'hover:bg-[#f5f4f0] dark:hover:bg-[#2c2c2c]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <AvatarImage
                        src={info.photoUrl}
                        mediaId={info.mediaId}
                        name={info.name}
                        sizeClass="w-10 h-10"
                        textSizeClass="text-xs"
                      />
                      {conv.type === 'dm' && info.isOnline && (
                        <span
                          title="Online now"
                          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#242424]"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#171717] dark:text-[#e5e1da] truncate">
                          {info.name}
                        </span>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-[#4e4c46] dark:text-[#b0b0b0] shrink-0">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0] truncate">
                        {conv.lastMessageText || info.subtitle}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-[10px] font-bold">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Chat Thread */}
        <section
          className={`md:col-span-8 flex flex-col min-h-0 ${
            activeConv ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <MessageCircle className="w-10 h-10 text-[#a5a5a5]" />
              <h3 className="text-lg font-display font-bold text-[#171717] dark:text-[#e5e1da]">
                Your Messages
              </h3>
              <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0] max-w-sm">
                Pick a conversation on the left, message a friend 1-on-1, or start a style group chat.
              </p>
            </div>
          ) : (
            <>
              {/* DM / Group Header */}
              {(() => {
                const info = getConvDisplay(activeConv);
                const otherBlocked = info.otherId ? isBlocked(info.otherId) : false;
                const otherMuted = info.otherId ? isMuted(info.otherId) : false;
                return (
                  <div className="p-3.5 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between gap-2 relative">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setActiveConvId(null)}
                        aria-label="Back to conversations"
                        className="md:hidden w-10 h-10 rounded-control flex items-center justify-center border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => info.otherId && onOpenProfile(info.otherId)}
                        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                      >
                        <AvatarImage
                          src={info.photoUrl}
                          mediaId={info.mediaId}
                          name={info.name}
                          sizeClass="w-9 h-9"
                          textSizeClass="text-xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-[#171717] dark:text-[#e5e1da] truncate">
                              {info.name}
                            </p>
                            {activeConv.type === 'dm' && info.isOnline && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0] truncate">
                            {typingUsersText || info.subtitle}
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {activeConv.type === 'group' && (
                        <button
                          type="button"
                          onClick={() => {
                            setGroupRenameValue(activeConv.name || '');
                            setShowGroupSettings(true);
                          }}
                          className="px-3 py-1.5 min-h-[38px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold text-[#171717] dark:text-[#e5e1da] cursor-pointer"
                        >
                          Group Info
                        </button>
                      )}
                      {activeConv.type === 'dm' && info.otherId && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowConvMenu((v) => !v)}
                            aria-label="Chat safety options"
                            className="w-10 h-10 rounded-control flex items-center justify-center border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {showConvMenu && (
                            <div className="absolute right-0 mt-1 w-48 rounded-card bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-lg p-1.5 z-20 space-y-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (info.peerProfile || info.otherId) {
                                    await toggleMute({
                                      uid: info.otherId!,
                                      username: info.peerProfile?.username || 'member',
                                      displayName: info.name,
                                    });
                                  }
                                  setShowConvMenu(false);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-control text-xs text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                              >
                                <VolumeX className="w-3.5 h-3.5" />
                                <span>{otherMuted ? 'Unmute user' : 'Mute user'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (info.otherId) {
                                    await toggleBlock({
                                      uid: info.otherId,
                                      username: info.peerProfile?.username || 'member',
                                      displayName: info.name,
                                    });
                                  }
                                  setShowConvMenu(false);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-control text-xs text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>{otherBlocked ? 'Unblock user' : 'Block user'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (info.otherId) {
                                    await reportItem({
                                      targetType: 'user',
                                      targetId: info.otherId,
                                      targetOwnerId: info.otherId,
                                      reason: 'Chat abuse report',
                                    });
                                    setChatError('Reported user to moderation queue.');
                                  }
                                  setShowConvMenu(false);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-control text-xs text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                              >
                                <Flag className="w-3.5 h-3.5" />
                                <span>Report user</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f5f4f0]/60 dark:bg-[#1b1b1b]">
                {convOldestDoc && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleLoadOlderConv}
                      disabled={loadingOlderConv}
                      className="px-3 py-1.5 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold cursor-pointer"
                    >
                      {loadingOlderConv ? 'Loading...' : 'Load older messages'}
                    </button>
                  </div>
                )}

                {convMessages
                  .filter((m) => !isBlocked(m.senderId) && !isMuted(m.senderId))
                  .map((msg, idx, filteredList) => {
                    const mine = msg.senderId === userProfile.uid;
                    const isLastOwn =
                      mine &&
                      idx ===
                        filteredList
                          .map((m, i) => (m.senderId === userProfile.uid ? i : -1))
                          .reduce((a, b) => Math.max(a, b), -1);
                    const peerSeen =
                      isLastOwn &&
                      activeConv.type === 'dm' &&
                      Object.entries(activeConv.lastReadAt || {}).some(
                        ([uid, ts]) =>
                          uid !== userProfile.uid &&
                          ts &&
                          new Date(ts).getTime() >= new Date(msg.createdAt).getTime()
                      );

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] sm:max-w-[70%] rounded-card p-3 space-y-1.5 border ${
                            mine
                              ? 'bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] border-transparent'
                              : 'bg-white dark:bg-[#242424] text-[#171717] dark:text-[#e5e1da] border-[#d4cfc5] dark:border-[#404040]'
                          }`}
                        >
                          {!mine && activeConv.type === 'group' && (
                            <p className="text-[10px] font-bold opacity-75">@{msg.senderUsername}</p>
                          )}
                          {msg.storyReplyCaption && (
                            <p className="text-[10px] px-2 py-0.5 rounded-chip bg-black/15 dark:bg-white/15 inline-block">
                              Replied to MyDay: {msg.storyReplyCaption}
                            </p>
                          )}
                          {msg.replyTo && (
                            <div className="text-[11px] px-2 py-1 rounded-chip bg-black/10 dark:bg-white/10 border-l-2 border-current opacity-85">
                              <span className="font-semibold">@{msg.replyTo.senderUsername}: </span>
                              <span className="line-clamp-1">{msg.replyTo.text}</span>
                            </div>
                          )}
                          {msg.sharedPostPreview && (
                            <div className="rounded-control overflow-hidden border border-current/15 bg-black/5 dark:bg-white/5 p-2 space-y-1">
                              {msg.sharedPostPreview.mediaUrl && (
                                <div className="h-32 rounded-chip overflow-hidden">
                                  <GarmentImage
                                    src={msg.sharedPostPreview.mediaUrl}
                                    alt="Shared fit preview"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <p className="text-[11px] font-semibold">
                                @{msg.sharedPostPreview.authorUsername}'s fit
                              </p>
                              <p className="text-[11px] opacity-80 line-clamp-2">
                                {msg.sharedPostPreview.caption}
                              </p>
                            </div>
                          )}
                          {msg.imageUrl && (
                            <div className="rounded-control overflow-hidden max-h-64">
                              <GarmentImage
                                src={msg.imageUrl}
                                mediaId={msg.mediaId}
                                alt={msg.altText || 'Chat image'}
                                className="w-full max-h-64 object-cover"
                              />
                            </div>
                          )}
                          {msg.text && <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>}

                          <div className="flex items-center justify-end gap-2 pt-0.5 opacity-70 text-[10px]">
                            <span>{formatTimeClock(msg.createdAt)}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setReplyingTo({
                                  id: msg.id,
                                  senderUsername: msg.senderUsername,
                                  text: msg.text || 'Photo',
                                })
                              }
                              aria-label="Reply to message"
                              className="hover:opacity-100 cursor-pointer"
                            >
                              <Reply className="w-3 h-3" />
                            </button>
                            {mine ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (isDemoMode) {
                                    setDemoMessagesForConv(activeConv.id, (prev) =>
                                      prev.filter((m) => m.id !== msg.id)
                                    );
                                  } else {
                                    await deleteConversationMessageFirestore(activeConv.id, msg.id);
                                  }
                                }}
                                aria-label="Delete your message"
                                className="hover:opacity-100 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  reportItem({
                                    targetType: 'message',
                                    targetId: msg.id,
                                    targetOwnerId: msg.senderId,
                                    reason: 'Reported message',
                                  })
                                }
                                aria-label="Report message"
                                className="hover:opacity-100 cursor-pointer"
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {peerSeen && (
                          <span className="text-[10px] text-[#4e4c46] dark:text-[#b0b0b0] mt-0.5 px-1">
                            Seen
                          </span>
                        )}
                      </div>
                    );
                  })}
                <div ref={bottomRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-2"
              >
                {chatError && (
                  <div className="text-xs px-3 py-1.5 rounded-control bg-[#eae7e0] dark:bg-[#303030] border border-[#d4cfc5] dark:border-[#555555] text-[#171717] dark:text-[#e5e1da]">
                    {chatError}
                  </div>
                )}

                {replyingTo && (
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-control bg-[#f5f4f0] dark:bg-[#1e1e1e] text-xs">
                    <span className="truncate">
                      Replying to <strong>@{replyingTo.senderUsername}</strong>: {replyingTo.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      aria-label="Cancel reply"
                      className="cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {stagedImage && (
                  <div className="flex items-center gap-2.5 p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#1e1e1e]">
                    <div className="w-12 h-12 rounded-chip overflow-hidden shrink-0">
                      <GarmentImage
                        src={stagedImage.thumbUrl}
                        mediaId={stagedImage.mediaId}
                        alt={stagedImage.altText || 'Staged upload'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <input
                      type="text"
                      value={stagedImage.altText}
                      onChange={(e) =>
                        setStagedImage((prev) => (prev ? { ...prev, altText: e.target.value } : prev))
                      }
                      placeholder="Photo alt text (optional)"
                      className="flex-1 px-2.5 py-1.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setStagedImage(null)}
                      aria-label="Remove staged photo"
                      className="w-8 h-8 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setDraftText((t) => `${t}${emoji}`)}
                        className="px-2 py-1 rounded-chip hover:bg-[#eae7e0] dark:hover:bg-[#303030] text-sm cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#4e4c46] dark:text-[#b0b0b0]">
                    {draftText.length}/1000
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <PhotoPickerButton
                    label=""
                    busy={uploadingPhoto}
                    title="Attach WebP photo"
                    ariaLabel="Attach WebP photo"
                    icon={<ImageIcon className="w-4 h-4" />}
                    className="w-11 h-11 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer shrink-0"
                    onFileSelected={handleStageImageFile}
                    onError={(msg) => setChatError(msg)}
                  />
                  <input
                    type="text"
                    maxLength={1000}
                    value={draftText}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    placeholder={uploadingPhoto ? 'Compressing WebP image...' : 'Write a message...'}
                    className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs text-[#171717] dark:text-[#e5e1da]"
                  />
                  <button
                    type="submit"
                    disabled={sending || uploadingPhoto || (!draftText.trim() && !stagedImage)}
                    aria-label="Send message"
                    className="w-11 h-11 rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] flex items-center justify-center disabled:opacity-45 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {/* New DM Modal (Friends-only) */}
      {showNewDm && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-modal p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#171717] dark:text-[#e5e1da]">
                Start Direct Message
              </h3>
              <button
                type="button"
                onClick={() => setShowNewDm(false)}
                className="w-9 h-9 rounded-control flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
              Direct messages are friends-only. Pick a friend below:
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {friendProfiles.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
                    You haven't added friends yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDm(false);
                      onNavigatePeople();
                    }}
                    className="px-3.5 py-2 rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
                  >
                    Go to People
                  </button>
                </div>
              ) : (
                friendProfiles.map((f) => (
                  <button
                    key={f.uid}
                    type="button"
                    onClick={() => handleStartDm(f)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] hover:bg-[#eae7e0] dark:hover:bg-[#303030] text-left cursor-pointer"
                  >
                    <AvatarImage src={f.photoURL} mediaId={f.mediaId} name={f.displayName} sizeClass="w-9 h-9" textSizeClass="text-xs" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{f.displayName}</p>
                      <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">@{f.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Group Chat Modal */}
      {showNewGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-modal p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold">New Group Chat</h3>
              <button
                type="button"
                onClick={() => setShowNewGroup(false)}
                className="w-9 h-9 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <AvatarImage
                src={groupPhotoDraft?.photoUrl}
                mediaId={groupPhotoDraft?.mediaId}
                name={groupName || 'G'}
                sizeClass="w-12 h-12"
                textSizeClass="text-base"
              />
              <PhotoPickerButton
                label="Group Photo (Optional)"
                busyLabel="Uploading..."
                busy={uploadingGroupPhoto}
                icon={<Upload className="w-3.5 h-3.5" />}
                className="px-3 py-2 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
                onFileSelected={(file) => handleUploadNewGroupPhotoFile(file)}
                onError={(msg) => setChatError(msg)}
              />
            </div>
            <input
              type="text"
              required
              maxLength={60}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Thrift Crew)"
              className="w-full px-3 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs"
            />
            <div className="max-h-48 overflow-y-auto space-y-2 border border-[#d4cfc5] dark:border-[#404040] rounded-control p-2.5">
              <p className="text-[11px] font-semibold text-[#4e4c46] dark:text-[#b0b0b0]">
                Select friends to add
              </p>
              {friendProfiles.length === 0 ? (
                <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
                  Add friends first to start a group chat.
                </p>
              ) : (
                friendProfiles.map((f) => (
                  <label key={f.uid} className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupSelectedIds.includes(f.uid)}
                      onChange={() =>
                        setGroupSelectedIds((prev) =>
                          prev.includes(f.uid) ? prev.filter((id) => id !== f.uid) : [...prev, f.uid]
                        )
                      }
                    />
                    <AvatarImage src={f.photoURL} mediaId={f.mediaId} name={f.displayName} sizeClass="w-6 h-6" textSizeClass="text-[10px]" />
                    <span>{f.displayName}</span>
                  </label>
                ))
              )}
            </div>
            <button
              type="submit"
              className="w-full py-2.5 min-h-[44px] rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
            >
              Create Group
            </button>
          </form>
        </div>
      )}

      {/* Group Settings Modal */}
      {showGroupSettings && activeConv && activeConv.type === 'group' && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-modal p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold">Group Settings</h3>
              <button
                type="button"
                onClick={() => setShowGroupSettings(false)}
                className="w-9 h-9 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <AvatarImage
                src={activeConv.photoUrl}
                mediaId={activeConv.mediaId}
                name={activeConv.name || 'G'}
                sizeClass="w-12 h-12"
                textSizeClass="text-base"
              />
              <PhotoPickerButton
                label="Change Group Photo"
                busyLabel="Updating..."
                busy={uploadingGroupPhoto}
                icon={<Upload className="w-3.5 h-3.5" />}
                className="px-3 py-2 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
                onFileSelected={(file) => handleUploadNewGroupPhotoFile(file, activeConv.id)}
                onError={(msg) => setChatError(msg)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={60}
                value={groupRenameValue}
                onChange={(e) => setGroupRenameValue(e.target.value)}
                className="flex-1 px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  if (groupRenameValue.trim()) {
                    await updateGroupChat(activeConv.id, { name: groupRenameValue.trim() });
                  }
                }}
                className="px-3 py-2 rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
              >
                Rename
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase text-[#4e4c46] dark:text-[#b0b0b0]">
                Members ({activeConv.participantIds.length})
              </p>
              {activeConv.participantIds.map((pid) => {
                const prof = activeConv.participantProfiles[pid];
                return (
                  <div key={pid} className="flex items-center justify-between text-xs py-1">
                    <span>{prof?.displayName || pid}</span>
                    {activeConv.adminIds?.includes(userProfile.uid) && pid !== userProfile.uid && (
                      <button
                        type="button"
                        onClick={async () => {
                          await updateGroupChat(activeConv.id, {
                            participantIds: activeConv.participantIds.filter((x) => x !== pid),
                          });
                        }}
                        className="text-[11px] underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
              {friendProfiles
                .filter((f) => !activeConv.participantIds.includes(f.uid))
                .map((f) => (
                  <div key={f.uid} className="flex items-center justify-between text-xs py-1 opacity-85">
                    <span>{f.displayName}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateGroupChat(activeConv.id, {
                          participantIds: [...activeConv.participantIds, f.uid],
                          participantProfiles: {
                            ...activeConv.participantProfiles,
                            [f.uid]: {
                              uid: f.uid,
                              username: f.username,
                              displayName: f.displayName,
                              photoUrl: f.photoURL,
                            },
                          },
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                await leaveConversation(activeConv.id);
                setShowGroupSettings(false);
                setActiveConvId(null);
              }}
              className="w-full py-2.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
            >
              Leave Group Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
