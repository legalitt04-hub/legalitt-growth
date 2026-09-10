import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;

export default function RoleSelectScreen({ navigation }) {
  const [role, setRole] = useState(null);

  const options = [
    { 
      id: 'client', 
      title: 'Client', 
      subtitle: 'Get Legal Services', 
      icon: 'person-outline' 
    },
    { 
      id: 'advocate', 
      title: 'Advocate', 
      subtitle: 'Offer Legal Services', 
      icon: 'scale-outline' 
    },
  ];

  const handleNext = async () => {
    if (!role) return;
    if (role === 'advocate') {
      // Advocate → dedicated advocate login/register flow
      navigation.navigate('AdvocateFlow');
    } else {
      // Client → go directly to client home as guest (login optional)
      await AsyncStorage.setItem('legalitt_role', 'client');
      navigation.replace('ClientMain');
    }
  };

  return (
    <View style={styles.safeContainer}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Role</Text>
      </View>

      <View style={styles.content}>
        {/* Role Options */}
        <View style={styles.optionsContainer}>
          {options.map(({ id, title, subtitle, icon }) => {
            const active = role === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setRole(id)}
                style={[
                  styles.optionCard,
                  active && styles.optionCardActive
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons 
                    name={icon} 
                    size={24} 
                    color={COLORS.primary} 
                  />
                </View>
                
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{title}</Text>
                  <Text style={styles.optionSubtitle}>{subtitle}</Text>
                </View>

                <View style={[
                  styles.checkbox,
                  active && styles.checkboxActive
                ]}>
                  {active && (
                    <Ionicons 
                      name="checkmark" 
                      size={16} 
                      color="#FFFFFF" 
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Choose Your Role</Text>
          <Text style={styles.descriptionText}>
            You have to choose your role and what is your profession
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !role && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={!role}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: isSmallDevice ? 20 : 24,
    paddingTop: isSmallDevice ? 32 : 40,
    paddingBottom: isSmallDevice ? 32 : 40,
  },
  optionsContainer: {
    gap: isSmallDevice ? 12 : 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallDevice ? 14 : 16,
    borderRadius: isSmallDevice ? 14 : 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E6F7F8',
  },
  iconCircle: {
    width: isSmallDevice ? 44 : 48,
    height: isSmallDevice ? 44 : 48,
    borderRadius: isSmallDevice ? 22 : 24,
    backgroundColor: '#E6F7F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    marginLeft: isSmallDevice ? 12 : 16,
  },
  optionTitle: {
    fontSize: isSmallDevice ? 15 : 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: isSmallDevice ? 11 : 12,
    color: '#6B7280',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  descriptionContainer: {
    alignItems: 'center',
    marginTop: isSmallDevice ? 32 : 40,
  },
  descriptionTitle: {
    fontSize: isSmallDevice ? 18 : 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: isSmallDevice ? 11 : 12,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: isSmallDevice ? 260 : 280,
    lineHeight: isSmallDevice ? 16 : 18,
  },
  spacer: {
    flex: 1,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
