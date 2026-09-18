import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Image, KeyboardAvoidingView, Platform,
  StatusBar, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { COLORS } from '../../constants/theme';
import { formatDate } from '../../utils/helpers';
import { useNetwork } from '../../context/NetworkContext';
import { getSocket, initiateCall } from '../../services/socket';

const ChatScreen = ({ navigation, route }) => {
  const {
    chatId, advocateName, advocateAvatar, advocateId,
    zegoRoomId, zegoToken, zegoAppId, zegoAppSign, mode: callMode,
    scheduledSlot, bookingId, bookingDate, advocateUserId,
    sessionExpiresAt: sessionExpiresAtParam, // ← from PaymentSuccess/BookingScreen
  } = route.params || {};
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const userData = user?.user || user || {};

  const {
    messages, loading, loadingMore, hasMore, connected, isTyping, error,
    sendMessage, sendTyping, sendStopTyping, loadMoreMessages,
  } = useChat(chatId, userData._id);

  const flatListRef = useRef(null);
  const [text, setText]       = useState('');
  const [sharing, setSharing] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [chatInitializing, setChatInitializing]   = useState(true);

  // Mark as initialized after first connection OR after 12s timeout
  useEffect(() => {
    if (connected) {
      setChatInitializing(false);
      setShowOfflineBanner(false);
      return;
    }
    // Give Render backend 12 seconds to cold-start before showing banner
    const initTimer = setTimeout(() => setChatInitializing(false), 12000);
    return () => clearTimeout(initTimer);
  }, [connected]);

  useEffect(() => {
    // Only show banner after initialization period is over
    if (chatInitializing || connected) { setShowOfflineBanner(false); return; }
    const timer = setTimeout(() => setShowOfflineBanner(true), 5000);
    return () => clearTimeout(timer);
  }, [connected, chatInitializing]);

  // ── Countdown Timer — uses sessionExpiresAt set by admin ──────
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [chatExpired, setChatExpired]     = useState(false);
  const [sessionLabel, setSessionLabel]   = useState('');
  const [extendedToast, setExtendedToast] = useState(false); // ← brief toast on extend
  const timerRef    = useRef(null);   // interval id
  const expiresRef  = useRef(null);   // latest expiry ISO string

  // Core: start/restart the 1-second tick from a given expiresAt
  const startTimer = useCallback((expiresAt) => {
    if (!expiresAt) return;
    expiresRef.current = expiresAt;
    if (timerRef.current) clearInterval(timerRef.current);
    setChatExpired(false);

    const tick = () => {
      const diff = new Date(expiresRef.current).getTime() - Date.now();
      if (diff <= 0) {
        setChatExpired(true);
        setTimeRemaining('00h 00m 00s');
        clearInterval(timerRef.current);
      } else {
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1000);
        setTimeRemaining(
          `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
        );
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  // Initial load: resolve expiry from param / API / fallback
  useEffect(() => {
    const resolveExpiry = async () => {
      if (sessionExpiresAtParam) {
        setSessionLabel(callMode === 'chat' ? 'Chat access' : callMode === 'video' ? 'Video access' : 'Voice access');
        startTimer(sessionExpiresAtParam);
        return;
      }
      if (bookingId) {
        try {
          const res = await api.get(`/bookings/${bookingId}`);
          const expires = res.data?.data?.sessionExpiresAt || res.data?.data?.booking?.sessionExpiresAt;
          const mode    = res.data?.data?.consultationMode || callMode || 'chat';
          if (expires) {
            setSessionLabel(mode === 'chat' ? 'Chat access' : mode === 'video' ? 'Video access' : 'Voice access');
            startTimer(expires);
            return;
          }
        } catch (err) {
          console.log('[Timer] booking fetch failed:', err.message);
        }
      }
      if (bookingDate) {
        startTimer(new Date(bookingDate).getTime() + 24 * 3_600_000);
      }
    };
    resolveExpiry();
    return () => clearInterval(timerRef.current);
  }, [bookingId, sessionExpiresAtParam, bookingDate, callMode, startTimer]);

  // ── Socket: listen for admin session extension ────────────────
  useEffect(() => {
    const socket = getSocket?.();
    if (!socket || !bookingId) return;

    const onSessionExtended = (data) => {
      // Only handle if it's for this booking
      if (data?.bookingId && data.bookingId !== bookingId) return;
      if (data?.sessionExpiresAt) {
        startTimer(data.sessionExpiresAt);
        // Show brief toast
        setExtendedToast(true);
        setTimeout(() => setExtendedToast(false), 4000);
      }
    };

    socket.on('session_extended', onSessionExtended);
    return () => socket.off('session_extended', onSessionExtended);
  }, [bookingId, startTimer]);

  // ── Send message handler ──────────────────────────────────────
  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text.trim());
    setText('');
    sendStopTyping();
    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Typing handler ────────────────────────────────────────────
  const handleTextChange = (v) => {
    setText(v);
    if (v.trim().length > 0) sendTyping();
    else sendStopTyping();
  };

  // ── Load older messages (pagination) ─────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadMoreMessages();
  }, [loadingMore, hasMore, loadMoreMessages]);

  const startCall = async (mode) => {
    if (callMode === 'chat') {
      Alert.alert('Chat Only', 'This consultation is chat-based. Voice/video calls are not included.');
      return;
    }
    if (!bookingId) {
      Alert.alert('Call unavailable', 'A paid booking is required to start a call.');
      return;
    }

    try {
      const { data } = await api.get(`/bookings/${bookingId}/can-join-call`);
      if (data?.canJoin === false) throw new Error(data.message || 'The call window is not open.');
      const callConfig = data?.data || {};
      await initiateCall({
        bookingId,
        chatId,
        zegoRoomId: callConfig.zegoRoomId,
        mode,
      });

      const isAdvocate = userData?.role === 'advocate';
      navigation.navigate(isAdvocate ? 'AdvocateCall' : 'VideoCall', {
        zegoRoomId: callConfig.zegoRoomId,
        zegoToken: callConfig.zegoToken,
        zegoAppId: callConfig.zegoAppId || 0,
        advocateName: isAdvocate ? undefined : advocateName,
        clientName: isAdvocate ? advocateName : undefined,
        myUserId: String(userData._id || ''),
        myUserName: String(userData.name || 'User'),
        mode,
        bookingId,
        advocateUserId: isAdvocate ? userData._id : (advocateUserId || advocateId),
        clientId: isAdvocate ? advocateId : userData._id,
      });
    } catch (err) {
      Alert.alert('Call unavailable', err.response?.data?.message || err.message || 'Could not prepare the secure call.');
    }
  };

  // ── Share image/document ──────────────────────────────────────
  const handleShareDocument = async () => {
    // Show choice: image or document
    Alert.alert(
      'Share File',
      'What would you like to share?',
      [
        {
          text: 'Image / Video',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Photo library access required.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled) {
              setSharing(true);
              try {
                const asset = result.assets[0];
                const uri = asset.uri;
                const filename = uri.split('/').pop();
                const ext = filename.split('.').pop()?.toLowerCase();
                const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', mov: 'video/quicktime' };
                const type = mimeMap[ext] || asset.mimeType || 'image/jpeg';
                const formData = new FormData();
                const { uploadAPI } = require('../../services/api');
                const response = await uploadAPI.uploadFile(uri, filename, type);
                const url = response.data?.data?.url || response.data?.url;
                if (url) {
                  sendMessage(filename, 'file', url, filename);
                  setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                } else {
                  Alert.alert('Upload Failed', response.data?.message || 'Server did not return file URL.');
                }
              } catch (err) {
                const msg = err?.response?.data?.message || err.message || 'Could not upload image.';
                Alert.alert('Upload Failed', msg);
              } finally {
                setSharing(false);
              }
            }
          },
        },
        {
          text: 'Document / PDF',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'text/plain', '*/*'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets?.[0]) {
                setSharing(true);
                try {
                  const asset = result.assets[0];
                  const { uploadAPI } = require('../../services/api');
                  const response = await uploadAPI.uploadFile(
                    asset.uri, 
                    asset.name, 
                    asset.mimeType || 'application/octet-stream'
                  );
                  const url = response.data?.data?.url || response.data?.url;
                  if (url) {
                    sendMessage(asset.name, 'file', url, asset.name);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                  } else {
                    Alert.alert('Upload Failed', response.data?.message || 'Server did not return file URL.');
                  }
                } catch (err) {
                  const msg = err?.response?.data?.message || err.message || 'Could not upload document.';
                  Alert.alert('Upload Failed', msg);
                } finally {
                  setSharing(false);
                }
              }
            } catch (err) {
              Alert.alert('Error', 'Could not open document picker.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Render individual message bubble ─────────────────────────
  const renderMessage = useCallback(({ item: msg }) => {
    const isMe = msg.sender === userData._id || msg.sender?._id === userData._id;
    const isDoc = msg.messageType === 'file' || msg.messageType === 'document' || (msg.fileUrl && !msg.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i));
    const isPending = msg.pending;

    // ── System / call messages — render as centered pill ──────────────
    if (msg.type === 'system' || msg.messageType === 'system' || msg.metadata?.callMissed || msg.metadata?.callCompleted) {
      const isVideo = msg.metadata?.mode === 'video';
      const isMissed = msg.metadata?.callMissed;
      const isCompleted = msg.metadata?.callCompleted;
      return (
        <View style={styles.systemMsgWrap}>
          <View style={styles.systemMsgPill}>
            <Ionicons
              name={isVideo ? (isMissed ? 'videocam-off' : 'videocam') : (isMissed ? 'call' : 'call')}
              size={13}
              color={isMissed ? '#EF4444' : '#10B981'}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.systemMsgText}>{msg.content || (isMissed ? 'Missed call' : 'Call ended')}</Text>
          </View>
          <Text style={styles.systemMsgTime}>{formatDate(msg.createdAt, 'time')}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isMe && (
          <View style={styles.messageAvatarContainer}>
            {advocateAvatar ? (
              <Image source={{ uri: advocateAvatar }} style={styles.messageAvatar} />
            ) : (
              <View style={styles.messageAvatarPlaceholder}>
                <Text style={styles.messageAvatarInitial}>{(advocateName || 'A')[0].toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, isPending && styles.bubblePending]}>
          {isDoc ? (
            <TouchableOpacity
              onPress={() => msg.fileUrl && navigation.navigate('DocumentViewer', {
                documentUrl: msg.fileUrl,
                fileName: msg.fileName || msg.content || 'Shared document',
                clientName: advocateName || 'Legal Counsel',
                caseTitle: 'Consultation document',
                hasDocument: true,
              })}
              style={styles.documentRow}
            >
              <Ionicons name="document-text" size={24} color={isMe ? '#FFFFFF' : COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.documentName, isMe ? styles.textWhite : styles.textDark]} numberOfLines={1}>
                  {msg.fileName || msg.content || 'Attached File'}
                </Text>
                <Text style={[styles.documentHint, isMe ? styles.textFade : styles.textSecondary]}>
                  Tap to open attachment
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.msgText, isMe ? styles.textWhite : styles.textDark]}>
              {msg.content}
            </Text>
          )}

          <View style={styles.bubbleMeta}>
            <Text style={[styles.msgTime, isMe ? styles.textFade : styles.textSecondary]}>
              {formatDate(msg.createdAt, 'time')}
            </Text>
            {isPending && (
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} />
            )}
            {isMe && !isPending && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={msg.readAt ? '#38BDF8' : 'rgba(255,255,255,0.6)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  }, [userData._id, advocateAvatar, advocateName, navigation]);

  const renderListHeader = () => {
    if (!hasMore) return (
      <View style={styles.startOfChat}>
        <Text style={styles.startOfChatText}>— Beginning of conversation —</Text>
      </View>
    );
    return null;
  };

  const renderListFooter = () => {
    if (!isTyping) return null;
    return (
      <View style={[styles.bubbleWrapper, styles.bubbleLeft]}>
        <View style={[styles.bubble, styles.bubbleThem, styles.typingBubble]}>
          <Text style={styles.typingText}>typing...</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ClientMain')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => {
            if (advocateId) {
              navigation.navigate('AdvocateProfile', { advocateId, advocateName, advocateAvatar });
            } else {
              Alert.alert('Notice', 'Please go back and re-open this chat to load the profile link.');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.participantAvatar}>
            {advocateAvatar ? (
              <Image source={{ uri: advocateAvatar }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarPlaceholderText}>{(advocateName || 'A')[0].toUpperCase()}</Text>
            )}
          </View>

          <View style={styles.headerMeta}>
            <Text style={styles.participantName} numberOfLines={1}>{advocateName || 'Legal Counsel'}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, connected ? styles.dotOnline : (chatInitializing ? styles.dotConnecting : styles.dotOffline)]} />
              <Text style={styles.statusLabel}>
                {connected ? 'online' : chatInitializing ? 'connecting…' : isConnected ? '' : 'offline'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Voice Call Button */}
          <TouchableOpacity
            style={[styles.callBtn, chatExpired && { opacity: 0.35 }]}
            onPress={() => !chatExpired && startCall('voice')}
          >
            <Ionicons name="call-outline" size={20} color={chatExpired ? '#9CA3AF' : COLORS.primary} />
          </TouchableOpacity>

          {/* Video Call Button */}
          <TouchableOpacity
            style={[styles.callBtn, chatExpired && { opacity: 0.35 }]}
            onPress={() => !chatExpired && startCall('video')}
          >
            <Ionicons name="videocam-outline" size={20} color={chatExpired ? '#9CA3AF' : COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scheduled Slot Banner */}
      {scheduledSlot && (
        <View style={styles.slotHeaderBanner}>
          <Ionicons name="time-outline" size={14} color="#D4AF37" />
          <Text style={styles.slotHeaderBannerText}>
            Session Slot: {scheduledSlot}
          </Text>
        </View>
      )}

      {/* Countdown Timer Banner — admin-configured duration */}
      {timeRemaining && !chatExpired && (
        <View style={styles.timerBanner}>
          <Ionicons name="hourglass-outline" size={14} color="#B45309" />
          <Text style={styles.timerBannerText}>
            {sessionLabel || 'Session'} ends in: {timeRemaining}
          </Text>
        </View>
      )}

      {chatExpired && (
        <View style={[styles.timerBanner, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
          <Ionicons name="lock-closed-outline" size={14} color="#DC2626" />
          <Text style={[styles.timerBannerText, { color: '#DC2626' }]}>
            {sessionLabel || 'Session'} expired. Admin can extend from dashboard.
          </Text>
        </View>
      )}
      {/* ✅ Session Extended toast — real-time from admin */}
      {extendedToast && (
        <View style={[styles.timerBanner, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
          <Ionicons name="checkmark-circle-outline" size={14} color="#16A34A" />
          <Text style={[styles.timerBannerText, { color: '#16A34A' }]}>
            ✅ Session extended by admin! Timer updated.
          </Text>
        </View>
      )}

      {/* Error / Offline banner — only show after init + delay */}
      {(showOfflineBanner && (!connected || !isConnected)) && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
          <Text style={styles.offlineBannerText}>
            {!isConnected
              ? 'No internet connection. Working offline.'
              : 'Chat server reconnecting… messages queued'}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 20}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item._id || `msg-${index}`}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.15}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            ListHeaderComponentStyle={{ paddingTop: 8 }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            // Pull-to-top for older messages indicator
            refreshing={loadingMore}
            onRefresh={handleLoadMore}
          />

          {/* Input Bar or Read-Only Banner */}
          {!isConnected ? (
            <View style={styles.readOnlyInputContainer}>
              <Ionicons name="eye-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <Text style={styles.readOnlyInputText}>Chat is in read-only mode while offline</Text>
            </View>
          ) : chatExpired ? (
            <View style={styles.readOnlyInputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <Text style={styles.readOnlyInputText}>Consultation window closed.</Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TouchableOpacity
                onPress={handleShareDocument}
                style={styles.attachmentBtn}
                disabled={sharing}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="attach" size={24} color="#6B7280" />
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={handleTextChange}
                placeholder="Type your message..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxHeight={100}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                textAlignVertical="center"
              />

              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                disabled={!text.trim()}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF9F8' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderColor: '#E8E2D8'
  },
  backBtn: { width: 36, padding: 4 },
  participantAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#B09C85',
    alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 18 },
  avatarPlaceholderText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  headerMeta: { flex: 1 },
  participantName: { fontSize: 14, fontWeight: '700', color: '#2E2A26' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotOnline:     { backgroundColor: '#10B981' },
  dotConnecting: { backgroundColor: '#F59E0B' }, // amber - connecting
  dotOffline:    { backgroundColor: '#9CA3AF' }, // gray - truly offline/disconnected
  statusLabel: { fontSize: 10, color: '#6D6A66', fontWeight: '500' },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F8F4EC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8E2D8',
  },
  slotHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF2E8',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#E8E2D8',
  },
  slotHeaderBannerText: {
    color: '#8D7865',
    fontSize: 12,
    fontWeight: '700',
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#FDE68A',
  },
  timerBannerText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#B45309', paddingHorizontal: 16, paddingVertical: 8
  },
  offlineBannerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', flex: 1 },

  messagesContent: { padding: 16, paddingBottom: 8 },

  startOfChat: { alignItems: 'center', paddingVertical: 16 },
  startOfChatText: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  bubbleWrapper: { flexDirection: 'row', marginBottom: 6 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1
  },
  bubbleMe: { backgroundColor: '#B09C85', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E8E2D8' },
  bubblePending: { opacity: 0.7 },

  msgText: { fontSize: 13, lineHeight: 19 },
  textWhite: { color: '#FFFFFF' },
  textDark: { color: '#2E2A26' },
  textFade: { color: 'rgba(255,255,255,0.7)' },
  textSecondary: { color: '#6D6A66' },

  messageAvatarContainer: { marginRight: 8, justifyContent: 'flex-end', paddingBottom: 4 },
  messageAvatar: { width: 28, height: 28, borderRadius: 14 },
  messageAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FAF2E8', alignItems: 'center', justifyContent: 'center' },
  messageAvatarInitial: { fontSize: 14, fontWeight: '700', color: '#B09C85' },

  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 9, fontWeight: '500' },

  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160, paddingVertical: 2 },
  documentName: { fontSize: 12, fontWeight: '700' },
  documentHint: { fontSize: 10, marginTop: 2 },

  typingBubble: { paddingVertical: 8, paddingHorizontal: 12 },
  typingText: { fontSize: 11, fontStyle: 'italic', color: '#6D6A66', fontWeight: '600' },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 10, borderTopWidth: 1, borderColor: '#E8E2D8',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10
  },
  attachmentBtn: { padding: 8, marginRight: 4 },
  textInput: {
    flex: 1, backgroundColor: '#F8F4EC', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 13,
    color: '#2E2A26', marginRight: 8, borderWidth: 1, borderColor: '#E8E2D8',
    minHeight: 40,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#B09C85', alignItems: 'center', justifyContent: 'center'
  },
  sendBtnDisabled: { backgroundColor: '#D6CFCE' },
  readOnlyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  readOnlyInputText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ChatScreen;
