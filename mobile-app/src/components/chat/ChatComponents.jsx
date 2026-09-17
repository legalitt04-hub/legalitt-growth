import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Platform, Image, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { formatDate, formatFileSize, getFileIcon } from '../../utils/helpers';

// ─── MessageBubble ────────────────────────────────────────────────────────────

export const MessageBubble = ({ message, isMe, showAvatar = true }) => {
  const isFile = message.messageType === 'file' || message.messageType === 'image';
  const isImage = message.messageType === 'image';
  const timeStr = formatDate(message.createdAt, 'time');

  const openAttachment = async () => {
    if (!message.fileUrl) {
      Alert.alert('Attachment unavailable', 'This message does not contain a valid document link.');
      return;
    }
    try {
      const supported = await Linking.canOpenURL(message.fileUrl);
      if (!supported) throw new Error('Unsupported attachment URL');
      await Linking.openURL(message.fileUrl);
    } catch {
      Alert.alert('Unable to open attachment', 'Please try again after checking your connection.');
    }
  };

  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      {/* Other user's avatar */}
      {!isMe && showAvatar && (
        <View style={styles.senderAvatar}>
          {message.sender?.avatar ? (
            <Image source={{ uri: message.sender.avatar }} style={styles.senderAvatarImg} />
          ) : (
            <Text style={styles.senderAvatarText}>
              {(message.sender?.name || 'A')[0].toUpperCase()}
            </Text>
          )}
        </View>
      )}
      {!isMe && !showAvatar && <View style={styles.avatarSpacer} />}

      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {/* File message */}
        {isFile && !isImage && (
          <TouchableOpacity style={styles.fileBubble} onPress={openAttachment}>
            <View style={styles.fileIconWrap}>
              <Ionicons
                name={getFileIcon(message.fileName)}
                size={24}
                color={isMe ? '#fff' : COLORS.primary}
              />
            </View>
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={1}>
                {message.fileName || 'Document'}
              </Text>
              <Text style={[styles.fileSize, isMe && styles.fileSizeMe]}>
                {formatFileSize(message.fileSize)} • Tap to view
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Image message */}
        {isImage && message.fileUrl && (
          <TouchableOpacity onPress={openAttachment}>
            <Image
              source={{ uri: message.fileUrl }}
              style={styles.imageMessage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Text message */}
        {!isFile && (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {message.content}
          </Text>
        )}

        {/* Timestamp */}
        <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
          {timeStr}
          {isMe && (
            <Text> </Text>
          )}
          {isMe && (
            <Ionicons
              name={message.readAt ? 'checkmark-done' : 'checkmark'}
              size={11}
              color={message.readAt ? '#93c5fd' : 'rgba(255,255,255,0.6)'}
            />
          )}
        </Text>
      </View>
    </View>
  );
};

// ─── TypingIndicator ──────────────────────────────────────────────────────────

export const TypingIndicator = ({ name }) => (
  <View style={styles.typingRow}>
    <View style={styles.typingBubble}>
      <View style={styles.dotsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, { opacity: 0.4 + i * 0.2 }]} />
        ))}
      </View>
    </View>
    {name && <Text style={styles.typingName}>{name} is typing</Text>}
  </View>
);

// ─── ChatInput ────────────────────────────────────────────────────────────────

export const ChatInput = ({ onSend, onAttach, onTyping, onCall, disabled = false }) => {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText('');
    setShowAttach(false);
  };

  const handleTextChange = (val) => {
    setText(val);
    onTyping?.();
  };

  return (
    <View>
      {/* Attach options panel */}
      {showAttach && (
        <View style={styles.attachPanel}>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={() => { onAttach?.('document'); setShowAttach(false); }}
          >
            <View style={styles.attachOptionIcon}>
              <Ionicons name="document-text" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.attachOptionLabel}>Document</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={() => { onAttach?.('image'); setShowAttach(false); }}
          >
            <View style={styles.attachOptionIcon}>
              <Ionicons name="image" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.attachOptionLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={() => { onAttach?.('camera'); setShowAttach(false); }}
          >
            <View style={styles.attachOptionIcon}>
              <Ionicons name="camera" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.attachOptionLabel}>Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity
          style={[styles.attachToggle, showAttach && styles.attachToggleActive]}
          onPress={() => setShowAttach(prev => !prev)}
          disabled={disabled}
        >
          <Ionicons name={showAttach ? 'close' : 'add'} size={22} color="#fff" />
        </TouchableOpacity>

        <TextInput
          value={text}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          multiline
          maxLength={2000}
          editable={!disabled}
          returnKeyType="default"
        />

        <TouchableOpacity style={styles.callIcon} onPress={onCall} disabled={disabled || !onCall}>
          <Ionicons name="call-outline" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // MessageBubble
  bubbleRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', paddingHorizontal: SIZES.screenPadding },
  bubbleRowMe: { flexDirection: 'row-reverse' },
  senderAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  senderAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  senderAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  avatarSpacer: { width: 40 },
  bubble: { maxWidth: '75%', borderRadius: 18, padding: SIZES.md, ...SHADOWS.sm },
  bubbleMe: { backgroundColor: COLORS.primaryLight, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: SIZES.body, color: COLORS.textPrimary, lineHeight: 22 },
  bubbleTextMe: { color: COLORS.textPrimary },
  timestamp: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, textAlign: 'right' },
  timestampMe: { color: 'rgba(13,148,136,0.7)' },
  fileBubble: { flexDirection: 'row', alignItems: 'center', minWidth: 180 },
  fileIconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textPrimary },
  fileNameMe: { color: COLORS.textPrimary },
  fileSize: { fontSize: SIZES.tiny, color: COLORS.primary, marginTop: 2 },
  fileSizeMe: { color: COLORS.primary },
  imageMessage: { width: 200, height: 150, borderRadius: SIZES.radiusMd },

  // TypingIndicator
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.screenPadding, paddingBottom: 8 },
  typingBubble: { backgroundColor: '#f3f4f6', borderRadius: 18, borderBottomLeftRadius: 4, padding: 12 },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.textMuted },
  typingName: { fontSize: SIZES.tiny, color: COLORS.textMuted, marginLeft: 8 },

  // ChatInput
  attachPanel: {
    flexDirection: 'row', gap: 20, backgroundColor: '#fff',
    paddingHorizontal: SIZES.screenPadding, paddingVertical: SIZES.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  attachOption: { alignItems: 'center', gap: 4 },
  attachOptionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  attachOptionLabel: { fontSize: SIZES.tiny, color: COLORS.textSecondary },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: SIZES.screenPadding, paddingVertical: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  attachToggle: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 1 },
  attachToggleActive: { backgroundColor: COLORS.error },
  input: { flex: 1, fontSize: SIZES.body, color: COLORS.textPrimary, paddingVertical: 8, paddingHorizontal: 2, maxHeight: 120, lineHeight: 22 },
  callIcon: { padding: 6, marginBottom: 1 },
  sendButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 6, marginBottom: 1 },
  sendButtonDisabled: { backgroundColor: COLORS.textMuted },
});
