import { Platform, View, ActivityIndicator, Text, StatusBar, TouchableOpacity, StyleSheet as RNStyleSheet, Dimensions } from 'react-native';

import AuthLoadingScreen from './AuthLoadingScreen';
import React, { useRef, useState, useEffect } from 'react';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import OfflineBanner from '../components/common/OfflineBanner';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// AUTH SCREENS
import SplashScreen from '../screens/auth/SplashScreen';
import LegalittIntroScreen from '../screens/auth/LegalittIntroScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginRegisterScreen from '../screens/auth/LoginRegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import TermsAcceptanceScreen from '../screens/auth/TermsAcceptanceScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// CLIENT SCREENS
import HomeScreen from '../screens/client/HomeScreen';

import AIAssistantScreen from '../screens/client/AIAssistantScreen';
import AdvocateProfileScreen from '../screens/client/AdvocateProfileScreen';
import FilterScreen from '../screens/client/FilterScreen';
import ProfileScreen from '../screens/client/ProfileScreen';
import PaymentScreen from '../screens/client/PaymentScreen';
import PaymentSuccessScreen from '../screens/client/PaymentSuccessScreen';
import MyBookingsScreen from '../screens/client/MyBookingsScreen';
import BookingScreen from '../screens/client/BookingScreen';
import FIRTypeSelector from '../screens/client/FIRTypeSelector';
import FIRDraftScreen from '../screens/client/FIRDraftScreen';
import DocumentForensicScreen from '../screens/client/DocumentForensicScreen';
import DocumentForensicUploadScreen from '../screens/client/DocumentForensicUploadScreen';
import DocumentForensicReviewScreen from '../screens/client/DocumentForensicReviewScreen';
import DocumentForensicPaymentScreen from '../screens/client/DocumentForensicPaymentScreen';
import DocumentForensicSuccessScreen from '../screens/client/DocumentForensicSuccessScreen';
import DocumentForensicTrackScreen from '../screens/client/DocumentForensicTrackScreen';
import DocumentForensicAnalysisScreen from '../screens/client/DocumentForensicAnalysisScreen';
import DocumentForensicExpertReviewScreen from '../screens/client/DocumentForensicExpertReviewScreen';
import DocumentForensicReportReadyScreen from '../screens/client/DocumentForensicReportReadyScreen';
import DocumentForensicCompleteScreen from '../screens/client/DocumentForensicCompleteScreen';
import FIRFormScreen from '../screens/client/FIRFormScreen';
import FIRPreviewScreen from '../screens/client/FIRPreviewScreen';
import AILegalNoticeScreen from '../screens/client/AILegalNoticeScreen';
import MyDraftsScreen from '../screens/client/MyDraftsScreen';
import ProfileEditScreen from '../screens/client/ProfileEditScreen';

import SettingsScreen from '../screens/client/SettingsScreen';
import PropertyResearchLandingScreen from '../screens/client/PropertyResearchLandingScreen';
import PropertyResearchFormScreen from '../screens/client/PropertyResearchFormScreen';
import PropertyResearchReviewScreen from '../screens/client/PropertyResearchReviewScreen';
import PropertyResearchPaymentScreen from '../screens/client/PropertyResearchPaymentScreen';
import PropertyResearchSuccessScreen from '../screens/client/PropertyResearchSuccessScreen';
import PropertyResearchTrackScreen from '../screens/client/PropertyResearchTrackScreen';
import PropertyResearchChecklistScreen from '../screens/client/PropertyResearchChecklistScreen';
import PropertyResearchLockScreen from '../screens/client/PropertyResearchLockScreen';

// LEGAL ADVICE CONSULTATION SCREENS
import LegalAdviceLandingScreen from '../screens/client/LegalAdviceLandingScreen';
import LegalMatterScreen from '../screens/client/LegalMatterScreen';
import ConsultationDetailsScreen from '../screens/client/ConsultationDetailsScreen';
import ReviewPaymentScreen from '../screens/client/ReviewPaymentScreen';
import ConsultationScheduledScreen from '../screens/client/ConsultationScheduledScreen';
import TrackConsultationScreen from '../screens/client/TrackConsultationScreen';
import ConsultationCompletedScreen from '../screens/client/ConsultationCompletedScreen';

// SHARED SCREENS
import ChatScreen from '../screens/shared/ChatScreen';
import ChatListScreen from '../screens/shared/ChatListScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import TermsConditionsScreen from '../screens/shared/TermsConditionsScreen';
import DataDeletionScreen from '../screens/shared/DataDeletionScreen';
import VideoCallScreen from '../screens/VideoCallScreen';

// ADVOCATE SCREENS
import AdvocateStack from './AdvocateStack';
import AdvocateDashboardScreen from '../screens/advocate/DashboardScreen';
import CaseRequestsScreen from '../screens/advocate/CaseRequestsScreen';
import EarningsScreen from '../screens/advocate/EarningsScreen';
import AdvocateWalletScreen from '../screens/advocate/AdvocateWalletScreen';
import DocumentUploadScreen from '../screens/advocate/DocumentUploadScreen';
import PendingApprovalScreen from '../screens/advocate/PendingApprovalScreen';
import { CasesScreen, ClientsScreen, CaseDetailScreen, ProfileEditScreen as AdvocateProfileEditScreen, ReviewRatingScreen, DocumentViewerScreen, AdvocateCallScreen, LegalNoticeResponseScreen } from '../screens/advocate';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TOKEN_KEY = 'authToken';
const REFRESH_KEY = 'refreshToken';
const BASE_URL = Constants.expoConfig?.extra?.API_URL;

// CLIENT BOTTOM TABS - 3 TABS (Map/Nearby removed)
const ClientTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AI') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          height: 70,
          paddingBottom: 16,
          paddingTop: 8,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          backgroundColor: '#FFFFFF',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="AI" 
        component={AIAssistantScreen}
        options={{ title: 'AI Assistant' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// ─── ADVOCATE FLOATING PILL NAV BAR ───────────────────────────────────────────

// Active (tan) and inactive (tan) color — white icon when active
const PILL_ACTIVE_BG = '#8C6E52';   // same muted tan as project primary
const PILL_INACTIVE_COLOR = '#8C6E52';
const PILL_ACTIVE_ICON = '#FFFFFF';

const PILL_TABS = [
  { name: 'Dashboard',   icon: 'home-outline',         iconActive: 'home'          },
  { name: 'TodayCases',  icon: 'scale-outline',        iconActive: 'scale'         },
  { name: 'Requests',    icon: 'people-outline',       iconActive: 'people'        },
  { name: 'Earnings',    icon: 'wallet-outline',       iconActive: 'wallet'        },
];

const AdvocatePillTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        pillStyles.wrapper,
        { bottom: Math.max(insets.bottom, 12) + 8 },
      ]}
      pointerEvents="box-none"
    >
      <View style={pillStyles.pill}>
        {PILL_TABS.map((tab, index) => {
          const route = state.routes[index];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = isFocused ? tab.iconActive : tab.icon;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.85}
              style={pillStyles.tabItem}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              {isFocused ? (
                <View style={pillStyles.activeCapsule}>
                  <Ionicons name={iconName} size={24} color={PILL_ACTIVE_ICON} />
                </View>
              ) : (
                <View style={pillStyles.inactiveItem}>
                  <Ionicons name={iconName} size={24} color={PILL_INACTIVE_COLOR} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const pillStyles = RNStyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    height: 70,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCapsule: {
    backgroundColor: PILL_ACTIVE_BG,
    width: 78,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveItem: {
    width: 78,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ADVOCATE BOTTOM TABS - 4 TABS FOR PRACTICE MANAGEMENT
const AdvocateTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AdvocatePillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdvocateDashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="TodayCases"
        component={CasesScreen}
        options={{ title: 'Today Cases' }}
      />
      <Tab.Screen
        name="Requests"
        component={CaseRequestsScreen}
        options={{ title: 'Requests' }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ title: 'Earnings' }}
      />
      <Tab.Screen
        name="AdvocateWallet"
        component={AdvocateWalletScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, user, isRestoring, consentAccepted } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(null); // null = loading
  const navigationRef = useRef(null);

  const refreshOnboardState = async () => {
    const val = await AsyncStorage.getItem('legalitt_onboarded');
    setHasOnboarded(!!val);
  };

  useEffect(() => { refreshOnboardState(); }, []);

  // When user logs out → force reset navigation to Onboarding
  useEffect(() => {
    if (!isAuthenticated && !isRestoring) {
      refreshOnboardState();
      // Reset navigation stack to Onboarding so ClientMain doesn't persist
      if (navigationRef.current?.isReady()) {
        navigationRef.current.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
        );
      }
    }
  }, [isAuthenticated, isRestoring]);

  // ─── SYNCHRONIZED SPLASH ANIMATION GATE ─────────────────────────────────
  // Render LegalittIntroScreen until the logo reveal animation completion event fires.
  // Prevents Home screen or Auth screens from appearing while animation is running.
  if (!splashFinished || hasOnboarded === null) {
    return (
      <View style={{ flex: 1, minHeight: Platform.OS === 'web' ? '100vh' : '100%', backgroundColor: '#000000' }}>
        <LegalittIntroScreen
          onAnimationComplete={() => {
            setSplashFinished(true);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: Platform.OS === 'web' ? '100vh' : '100%', backgroundColor: '#000000' }}>
      <OfflineBanner />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 400 }}>
          {!consentAccepted ? (
            // ─── CONSENT GATE FLOW (UNACCEPTED) ────────────────────────
            <>
              <Stack.Screen name="TermsAcceptance" component={TermsAcceptanceScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
            </>
          ) : !isAuthenticated ? (
            // ─── UNAUTHENTICATED: Onboarding first (3 slides), then ClientMain ──
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="ClientMain" component={ClientTabs} />
              <Stack.Screen name="AdvocateProfile" component={AdvocateProfileScreen} />
              <Stack.Screen name="Filter" component={FilterScreen} />
              <Stack.Screen name="Booking" component={BookingScreen} />
              <Stack.Screen name="Payment" component={PaymentScreen} />
              <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
              <Stack.Screen name="ChatList" component={ChatListScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
              <Stack.Screen name="FIRDraft" component={FIRDraftScreen} />
              <Stack.Screen name="FIRTypeSelector" component={FIRDraftScreen} />
              <Stack.Screen name="DocumentForensic" component={DocumentForensicScreen} />
              <Stack.Screen name="DocumentForensicUpload" component={DocumentForensicUploadScreen} />
              <Stack.Screen name="DocumentForensicReview" component={DocumentForensicReviewScreen} />
              <Stack.Screen name="DocumentForensicPayment" component={DocumentForensicPaymentScreen} />
              <Stack.Screen name="DocumentForensicSuccess" component={DocumentForensicSuccessScreen} />
              <Stack.Screen name="DocumentForensicTrack" component={DocumentForensicTrackScreen} />
              <Stack.Screen name="DocumentForensicAnalysis" component={DocumentForensicAnalysisScreen} />
              <Stack.Screen name="DocumentForensicExpertReview" component={DocumentForensicExpertReviewScreen} />
              <Stack.Screen name="DocumentForensicReportReady" component={DocumentForensicReportReadyScreen} />
              <Stack.Screen name="DocumentForensicComplete" component={DocumentForensicCompleteScreen} />
              <Stack.Screen name="FIRForm" component={FIRFormScreen} />
              <Stack.Screen name="FIRPreview" component={FIRPreviewScreen} />
              <Stack.Screen name="AILegalNotice" component={AILegalNoticeScreen} />
              <Stack.Screen name="MyDrafts" component={MyDraftsScreen} />
              <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
              <Stack.Screen name="PropertyResearchLanding" component={PropertyResearchLandingScreen} />
              <Stack.Screen name="PropertyResearchForm" component={PropertyResearchFormScreen} />
              <Stack.Screen name="PropertyResearchConfirm" component={PropertyResearchReviewScreen} />
              <Stack.Screen name="PropertyResearchPayment" component={PropertyResearchPaymentScreen} />
              <Stack.Screen name="PropertyResearchSuccess" component={PropertyResearchSuccessScreen} />
              <Stack.Screen name="PropertyResearchTrack" component={PropertyResearchTrackScreen} />
              <Stack.Screen name="PropertyResearchChecklist" component={PropertyResearchChecklistScreen} />
              <Stack.Screen name="PropertyResearchLock" component={PropertyResearchLockScreen} />
              <Stack.Screen name="LegalAdviceLanding" component={LegalAdviceLandingScreen} />
              <Stack.Screen name="LegalMatter" component={LegalMatterScreen} />
              <Stack.Screen name="ConsultationDetails" component={ConsultationDetailsScreen} />
              <Stack.Screen name="ReviewPayment" component={ReviewPaymentScreen} />
              <Stack.Screen name="ConsultationScheduled" component={ConsultationScheduledScreen} />
              <Stack.Screen name="TrackConsultation" component={TrackConsultationScreen} />
              <Stack.Screen name="ConsultationCompleted" component={ConsultationCompletedScreen} />
              <Stack.Screen name="VideoCall" component={VideoCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              
              <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
              <Stack.Screen name="LoginRegister" component={LoginRegisterScreen} />
              <Stack.Screen name="OTP" component={OTPScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="AdvocateFlow" component={AdvocateStack} />
              {/* Advocate registration completion screens — needed when user registers as advocate */}
              <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
              <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
              <Stack.Screen name="DataDeletion" component={DataDeletionScreen} />
            </>
          ) : user?.role === 'advocate' ? (
            // ─── ADVOCATE PRACTICE MANAGEMENT FLOW (AUTHENTICATED) ────────
            <>
              <Stack.Screen name="AdvocateMain" component={AdvocateTabs} />
              <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
              <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
              <Stack.Screen name="Cases" component={CasesScreen} />
              <Stack.Screen name="CaseRequests" component={CaseRequestsScreen} />
              <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
              <Stack.Screen name="Clients" component={ClientsScreen} />
              <Stack.Screen name="AdvocateProfileEdit" component={AdvocateProfileEditScreen} />
              <Stack.Screen name="ReviewRating" component={ReviewRatingScreen} />
              <Stack.Screen name="LegalNoticeResponse" component={LegalNoticeResponseScreen} />
              <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} />
              <Stack.Screen name="ChatList" component={ChatListScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="AdvocateCall" component={AdvocateCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false, headerShown: false }} />
              <Stack.Screen name="VideoCall" component={AdvocateCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false, headerShown: false }} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
              <Stack.Screen name="DataDeletion" component={DataDeletionScreen} />
            </>
          ) : (
            // ─── CLIENT EXPERIENCE FLOW (AUTHENTICATED) ───────────────────
            <>
              <Stack.Screen name="ClientMain" component={ClientTabs} />
              <Stack.Screen name="AdvocateProfile" component={AdvocateProfileScreen} />
              <Stack.Screen name="Filter" component={FilterScreen} />
              <Stack.Screen name="Booking" component={BookingScreen} />
              <Stack.Screen name="Payment" component={PaymentScreen} />
              <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
              <Stack.Screen name="ChatList" component={ChatListScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
              <Stack.Screen name="FIRDraft" component={FIRDraftScreen} />
              <Stack.Screen name="FIRTypeSelector" component={FIRDraftScreen} />
              <Stack.Screen name="DocumentForensic" component={DocumentForensicScreen} />
              <Stack.Screen name="DocumentForensicUpload" component={DocumentForensicUploadScreen} />
              <Stack.Screen name="DocumentForensicReview" component={DocumentForensicReviewScreen} />
              <Stack.Screen name="DocumentForensicPayment" component={DocumentForensicPaymentScreen} />
              <Stack.Screen name="DocumentForensicSuccess" component={DocumentForensicSuccessScreen} />
              <Stack.Screen name="DocumentForensicTrack" component={DocumentForensicTrackScreen} />
              <Stack.Screen name="DocumentForensicAnalysis" component={DocumentForensicAnalysisScreen} />
              <Stack.Screen name="DocumentForensicExpertReview" component={DocumentForensicExpertReviewScreen} />
              <Stack.Screen name="DocumentForensicReportReady" component={DocumentForensicReportReadyScreen} />
              <Stack.Screen name="DocumentForensicComplete" component={DocumentForensicCompleteScreen} />
              <Stack.Screen name="FIRForm" component={FIRFormScreen} />
              <Stack.Screen name="FIRPreview" component={FIRPreviewScreen} />
              <Stack.Screen name="AILegalNotice" component={AILegalNoticeScreen} />
              <Stack.Screen name="MyDrafts" component={MyDraftsScreen} />
              <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
              <Stack.Screen name="PropertyResearchLanding" component={PropertyResearchLandingScreen} />
              <Stack.Screen name="PropertyResearchForm" component={PropertyResearchFormScreen} />
              <Stack.Screen name="PropertyResearchConfirm" component={PropertyResearchReviewScreen} />
              <Stack.Screen name="PropertyResearchPayment" component={PropertyResearchPaymentScreen} />
              <Stack.Screen name="PropertyResearchSuccess" component={PropertyResearchSuccessScreen} />
              <Stack.Screen name="PropertyResearchTrack" component={PropertyResearchTrackScreen} />
              <Stack.Screen name="PropertyResearchChecklist" component={PropertyResearchChecklistScreen} />
              <Stack.Screen name="PropertyResearchLock" component={PropertyResearchLockScreen} />

              {/* LEGAL ADVICE CONSULTATION FLOW */}
              <Stack.Screen name="LegalAdviceLanding" component={LegalAdviceLandingScreen} />
              <Stack.Screen name="LegalMatter" component={LegalMatterScreen} />
              <Stack.Screen name="ConsultationDetails" component={ConsultationDetailsScreen} />
              <Stack.Screen name="ReviewPayment" component={ReviewPaymentScreen} />
              <Stack.Screen name="ConsultationScheduled" component={ConsultationScheduledScreen} />
              <Stack.Screen name="TrackConsultation" component={TrackConsultationScreen} />
              <Stack.Screen name="ConsultationCompleted" component={ConsultationCompletedScreen} />

              {/* VIDEO & VOICE CALL */}
              <Stack.Screen name="VideoCall" component={VideoCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />

              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
              <Stack.Screen name="DataDeletion" component={DataDeletionScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

export default AppNavigator;
