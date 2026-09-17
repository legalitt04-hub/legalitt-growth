// screens/client/ProfileScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { bookingAPI, firAPI, chatAPI, legalAdviceAPI } from '../../services/api';

const ProfileScreen = ({ navigation }) => {
  const { user, isAuthenticated, refreshUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [completeness, setCompleteness] = useState(user?.completeness || 0);
  const [stats, setStats] = useState({ consultations: 0, drafts: 0, chats: 0 });

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      if (isAuthenticated) {
        handleRefresh();
        fetchRealStats();
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (unsubscribe?.remove) unsubscribe.remove();
    };
  }, [navigation, isAuthenticated]);

  useEffect(() => {
    if (user) setCompleteness(user.completeness || 0);
  }, [user]);

  const fetchRealStats = async () => {
    try {
      const [bookingsRes, draftsRes, firRequestsRes, chatsRes] = await Promise.allSettled([
        bookingAPI.getMy(),
        firAPI.getMyDrafts(),
        legalAdviceAPI.getMyRequests({ serviceType: 'fir_draft' }),
        chatAPI.getChats(),
      ]);
      const generatedDrafts = draftsRes.status === 'fulfilled' ? (draftsRes.value.data?.data?.length || 0) : 0;
      const assistedDrafts = firRequestsRes.status === 'fulfilled' ? (firRequestsRes.value.data?.data?.length || 0) : 0;
      setStats({
        consultations: bookingsRes.status === 'fulfilled' ? (bookingsRes.value.data?.data?.length || 0) : 0,
        drafts: generatedDrafts + assistedDrafts,
        chats: chatsRes.status === 'fulfilled' ? (chatsRes.value.data?.data?.length || chatsRes.value.data?.length || 0) : 0,
      });
    } catch (err) {
      console.log('Error fetching profile stats:', err);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await refreshUser();
    setLoading(false);
  };

  // Menu items — if guest, navigate to login instead
  const menuItems = [
    { id: '0', icon: 'time-outline',        title: 'My FIR Drafts',    subtitle: 'View and manage your FIR drafts',        screen: 'MyDrafts',      requiresAuth: true  },
    { id: '1', icon: 'chatbubble-outline',   title: 'My Chats',         subtitle: 'All conversations with advocates',      screen: 'ChatList',      requiresAuth: true  },
    { id: '2', icon: 'document-text-outline',title: 'My Requests',      subtitle: 'Status and Report',                     screen: 'MyBookings',    requiresAuth: true  },
    { id: '4', icon: 'settings-outline',     title: 'Settings',         subtitle: 'Language, notification & Privacy',      screen: 'Settings',      requiresAuth: false },
    { id: '5', icon: 'headset-outline',      title: 'Help & Support',   subtitle: 'Contact us for assistance',             screen: 'Support',       requiresAuth: false },
    { id: '6', icon: 'card-outline',         title: 'Payments',         subtitle: 'Consultation Payments & invoice',       screen: 'MyBookings',    requiresAuth: true  },
  ];

  const handleMenuPress = (item) => {
    if (item.requiresAuth && !isAuthenticated) {
      Alert.alert(
        'Sign in Required',
        'Please sign in to access this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign in', onPress: () => navigation.navigate('LoginRegister', { role: 'client' }) },
        ]
      );
      return;
    }
    navigation.navigate(item.screen);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await AsyncStorage.removeItem('legalitt_onboarded');
            await logout();
            // AppNavigator's navigationRef useEffect handles redirecting to Onboarding
            // when isAuthenticated becomes false - no manual reset needed here
            setLoading(false);
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Loading state removed to allow silent pull-to-refresh without blocking UI

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        {!isAuthenticated && (
          <TouchableOpacity
            style={styles.signInHeaderBtn}
            onPress={() => navigation.navigate('LoginRegister', { role: 'client' })}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={16} color="#fff" />
            <Text style={styles.signInHeaderBtnTxt}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Section */}
        <View style={styles.userSection}>
          {isAuthenticated && user?.avatar ? (
            <Image source={{ uri: user.avatar || user?.user?.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={44} color={COLORS.primary} />
            </View>
          )}
          <Text style={styles.userName}>
            {isAuthenticated ? (user?.name || user?.user?.name || 'Legalitt User') : 'Guest User'}
          </Text>
          <Text style={styles.userEmail}>
            {isAuthenticated ? (user?.email || user?.user?.email || '') : 'Sign in to access all features'}
          </Text>

          {isAuthenticated && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('ProfileEdit')}
            >
              <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Bar */}
        <View style={styles.statsCardContainer}>
          <TouchableOpacity style={styles.statBox} onPress={() => handleMenuPress({ screen: 'MyBookings', requiresAuth: true })} activeOpacity={0.7}>
            <Text style={styles.statNumText}>{isAuthenticated ? stats.consultations : '-'}</Text>
            <Text style={styles.statLabelText}>Bookings</Text>
          </TouchableOpacity>
          <View style={styles.statVLine} />
          <TouchableOpacity style={styles.statBox} onPress={() => handleMenuPress({ screen: 'MyDrafts', requiresAuth: true })} activeOpacity={0.7}>
            <Text style={styles.statNumText}>{isAuthenticated ? stats.drafts : '-'}</Text>
            <Text style={styles.statLabelText}>FIR Drafts</Text>
          </TouchableOpacity>
          <View style={styles.statVLine} />
          <TouchableOpacity style={styles.statBox} onPress={() => handleMenuPress({ screen: 'ChatList', requiresAuth: true })} activeOpacity={0.7}>
            <Text style={styles.statNumText}>{isAuthenticated ? stats.chats : '-'}</Text>
            <Text style={styles.statLabelText}>Chats</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Completeness — only when logged in */}
        {isAuthenticated && (
          <View style={styles.completenessContainer}>
            <View style={styles.completenessHeader}>
              <Text style={styles.completenessTitle}>Profile Completeness</Text>
              <Text style={styles.completenessValue}>{completeness}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${completeness}%` }]} />
            </View>
            {completeness < 100 && (
              <Text style={styles.completenessHint}>Complete your profile to get better legal recommendations.</Text>
            )}
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: COLORS.primary }]}>
                <Ionicons name={item.icon} size={18} color="#FFFFFF" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              {item.requiresAuth && !isAuthenticated
                ? <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
                : <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              }
            </TouchableOpacity>
          ))}

          {/* Logout — only when logged in */}
          {isAuthenticated && (
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <View style={[styles.menuIcon, styles.logoutIcon]}>
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, styles.logoutText]}>Logout</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sign-in CTA — only when guest */}
        {!isAuthenticated && (
          <View style={styles.signInBox}>
            <Text style={styles.signInTitle}>Sign in to unlock all features</Text>
            <Text style={styles.signInSub}>Bookings, chats, drafts and more await you</Text>
            <TouchableOpacity
              style={styles.signInClientBtn}
              onPress={() => navigation.navigate('LoginRegister', { role: 'client' })}
              activeOpacity={0.85}
            >
              <Ionicons name="person-circle-outline" size={20} color="#fff" />
              <Text style={styles.signInClientBtnTxt}>Sign in as Client</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signInAdvBtn}
              onPress={() => navigation.navigate('AdvocateFlow')}
              activeOpacity={0.85}
            >
              <Ionicons name="briefcase-outline" size={20} color={COLORS.accent} />
              <Text style={styles.signInAdvBtnTxt}>Are you an Advocate?</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', textAlign: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  userSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48, marginBottom: 12,
    backgroundColor: '#EEF4FA', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.primary,
  },
  userName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  userEmail: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(176,156,133,0.12)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, marginTop: 8 },
  editButtonText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  completenessContainer: { paddingHorizontal: 20, marginBottom: 25 },
  completenessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  completenessTitle: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  completenessValue: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  progressBarBg: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  completenessHint: { fontSize: 11, color: '#6b7280', marginTop: 8, fontStyle: 'italic' },
  menuSection: { paddingHorizontal: 20, gap: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  menuSubtitle: { fontSize: 11, color: '#6B7280' },
  logoutIcon: { backgroundColor: '#EF4444' },
  logoutText: { color: '#EF4444' },
  statsCardContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#F8FAF5', marginHorizontal: 20, marginBottom: 20, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E8E2D8' },
  statBox: { alignItems: 'center', flex: 1 },
  statNumText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  statLabelText: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginTop: 2 },
  statVLine: { width: 1, height: 24, backgroundColor: '#E2E8F0' },
  // Sign-in CTA box
  signInHeaderBtn: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  signInHeaderBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  signInBox: { margin: 20, marginTop: 24, backgroundColor: '#F0F4FF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#D1D9F0' },
  signInTitle: { fontSize: 16, fontWeight: '800', color: COLORS.primary, marginBottom: 6, textAlign: 'center' },
  signInSub: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  signInClientBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, width: '100%', justifyContent: 'center', marginBottom: 12 },
  signInClientBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  signInAdvBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, width: '100%', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.accent, backgroundColor: '#FFFCF0' },
  signInAdvBtnTxt: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },
});

export default ProfileScreen;
