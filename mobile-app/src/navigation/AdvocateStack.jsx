import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RegisterScreen from '../screens/advocate/RegisterScreen';
import DocumentUploadScreen from '../screens/advocate/DocumentUploadScreen';
import PendingApprovalScreen from '../screens/advocate/PendingApprovalScreen';
import LoginScreen from '../screens/advocate/LoginScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import TermsConditionsScreen from '../screens/shared/TermsConditionsScreen';

const Stack = createNativeStackNavigator();

export default function AdvocateStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="AdvocateLogin" component={LoginScreen} />
      <Stack.Screen name="AdvocateRegister" component={RegisterScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
    </Stack.Navigator>
  );
}
