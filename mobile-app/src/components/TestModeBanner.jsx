// components/TestModeBanner.jsx
// Shows Razorpay test card details during development/testing
// Import and drop into any payment screen — it auto-hides in production

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Show banner in dev builds OR when explicitly enabled
const IS_TEST = __DEV__;

const ROWS = [
  { label: 'Card No',  value: '4111 1111 1111 1111' },
  { label: 'Expiry',   value: 'Any future (e.g. 12/26)' },
  { label: 'CVV',      value: 'Any 3 digits (e.g. 123)' },
  { label: 'OTP',      value: '1234' },
  { label: 'UPI',      value: 'success@razorpay' },
];

export default function TestModeBanner() {
  if (!IS_TEST) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>🧪 Test Mode — Razorpay</Text>
      <Text style={styles.sub}>No real money is charged. Use test credentials below:</Text>
      {ROWS.map(({ label, value }) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    padding: 14,
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  sub: {
    fontSize: 11,
    color: '#78350F',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    width: 62,
  },
  value: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
});
