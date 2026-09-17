import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  StatusBar, Image, ActivityIndicator, TextInput, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatList } from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES } from '../../constants/theme';
import api from '../../services/api';
import SkeletonLoader from '../../components/common/SkeletonLoader';


const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { chats, loading, refetch } = useChatList();
  const [localChats, setLocalChats] = React.useState([]);
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    setLocalChats(chats || []);
  }, [chats]);

  const getOtherParticipant = (chat) => {
    if (!chat.participants) return {};
    const myIdStr = user?._id?.toString() || user?.id?.toString();
    if (!myIdStr) return {};
    
    // Find the participant whose ID does not match mine
    const other = chat.participants.find(p => {
      const pIdStr = p._id?.toString() || p.toString();
      return pIdStr !== myIdStr;
    });
    
    return other || {};
  };

  const handleDeleteConversation = (chatId) => {
    if (!chatId) {
      Alert.alert('Error', 'Invalid chat. Please refresh and try again.');
      return;
    }
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this chat? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update — remove immediately from UI
            setLocalChats(prev => prev.filter(c => (c._id || c.id) !== chatId));
            try {
              await api.delete(`/chats/${chatId}`);
              // Success — keep it removed (don't refetch immediately to avoid flash)
              setTimeout(() => refetch(), 1000); // refetch after 1s to sync with server
            } catch (err) {
              console.error('Delete chat failed:', err?.response?.data?.message || err.message);
              refetch(); // roll back by reloading from server
              Alert.alert('Error', err?.response?.data?.message || 'Could not delete. Please try again.');
            }
          },
        },
      ]
    );
  };


  const filteredChats = localChats
    .filter(c => {
      const other = getOtherParticipant(c);
      const otherName = (other.name || '').toLowerCase();
      return otherName.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
      return dateB - dateA;
    });

  const renderItem = ({ item }) => {
    const other = getOtherParticipant(item);
    const unreadCount = item.unreadCount || 0;
    const lastMsg = item.lastMessage?.content || 'Start chatting';
    const isUnread = unreadCount > 0;
    const otherAvatar = other.avatar || null;

    return (
      <View style={styles.chatRow}>
        {/* Main tappable area → opens chat */}
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() => navigation.navigate('Chat', { 
            chatId: item._id, 
            advocateName: other.name, 
            advocateAvatar: otherAvatar,
            advocateId: other._id,
            bookingId: item.booking?._id,
            bookingDate: item.booking?.date,
          })}
          activeOpacity={0.8}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.chatAvatar}>
              {otherAvatar ? (
                <Image source={{ uri: otherAvatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(other.name || 'U')[0].toUpperCase()}</Text>
              )}
            </View>
            {other.isOnline && <View style={styles.onlineBadge} />}
          </View>

          <View style={styles.chatBody}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName}>{other.name || 'Legal Client'}</Text>
              <Text style={styles.chatTime}>
                {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </View>
            <View style={styles.chatFooter}>
              <Text style={[styles.chatLast, isUnread && styles.chatLastUnread]} numberOfLines={1}>
                {lastMsg}
              </Text>
              {isUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Delete button — sibling, not child, to avoid Android touch conflict */}
        <TouchableOpacity
          onPress={() => handleDeleteConversation(item._id || item.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Conversations</Text>
        <TouchableOpacity onPress={refetch} style={styles.refreshBtn}>
          <Ionicons name="reload" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name..."
          placeholderTextColor="#9CA3AF"
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {loading && localChats.length === 0 ? (
        <View style={{ padding: 16 }}>
          <SkeletonLoader type="clientRow" count={6} />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>💬</Text>
              <Text style={styles.emptyText}>No active conversations found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderColor: '#F3F4F6'
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    margin: 16, paddingHorizontal: 12, borderRadius: 12, height: 44,
    borderWidth: 1, borderColor: '#E5E7EB'
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.textPrimary, paddingVertical: 8 },
  clearBtn: { padding: 4 },

  list: { paddingBottom: 100 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    paddingRight: 12,
  },
  chatItem: { 
    flex: 1,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, 
    paddingVertical: 14,
  },
  avatarContainer: { position: 'relative' },
  chatAvatar: { 
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, 
    alignItems: 'center', justifyContent: 'center', marginRight: 12 
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 24 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  onlineBadge: {
    position: 'absolute', right: 10, bottom: 0, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF'
  },
  
  chatBody: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  chatTime: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  chatLast: { fontSize: 12, color: '#6B7280', flex: 1, marginRight: 10 },
  chatLastUnread: { color: COLORS.textPrimary, fontWeight: '700' },
  
  unreadBadge: { 
    backgroundColor: COLORS.primary, minWidth: 18, height: 18, 
    borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  deleteBtn: { padding: 10, alignSelf: 'center' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' }
});

export default ChatListScreen;
