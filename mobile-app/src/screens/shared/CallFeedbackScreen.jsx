import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { reviewAPI } from '../../services/api';

export default function CallFeedbackScreen({ navigation, route }) {
  const { bookingId, advocateUserId, clientId, duration } = route?.params || {};
  const insets = useSafeAreaInsets();
  
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Hold on', 'Please select a star rating first!');
      return;
    }
    if (!bookingId) {
      Alert.alert('Feedback unavailable', 'This call is not linked to a completed booking.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await reviewAPI.create({
        bookingId,
        advocateId: advocateUserId,
        rating,
        comment: feedback
      });
      setIsSubmitting(false);
      Alert.alert('Thank You!', 'Your feedback helps us improve.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert('Feedback not submitted', error?.response?.data?.message || 'Please try again.');
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => setRating(i)} activeOpacity={0.7} style={styles.starBtn}>
          <Ionicons 
            name={i <= rating ? 'star' : 'star-outline'} 
            size={40} 
            color={i <= rating ? '#FBBF24' : 'rgba(255,255,255,0.3)'} 
          />
        </TouchableOpacity>
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.root} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#0B1120', '#1E3A5F']} style={StyleSheet.absoluteFillObject} />
      
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <Ionicons name="checkmark-circle" size={64} color="#10B981" style={styles.icon} />
        
        <Text style={styles.title}>Call Ended</Text>
        
        {duration > 0 && (
          <Text style={styles.duration}>
            Duration: {Math.floor(duration / 60)} min {duration % 60} sec
          </Text>
        )}
        
        <View style={styles.card}>
          <Text style={styles.question}>How was your consultation?</Text>
          {renderStars()}
          
          <TextInput
            style={styles.input}
            placeholder="Tell us more about your experience... (optional)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            numberOfLines={4}
            value={feedback}
            onChangeText={setFeedback}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
            <Text style={styles.submitBtnText}>{isSubmitting ? 'Submitting...' : 'Submit Feedback'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  icon: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  duration: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32 },
  
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  question: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 20 },
  starsContainer: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  starBtn: { padding: 4 },
  
  input: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  
  footer: { marginTop: 'auto', width: '100%', alignItems: 'center', gap: 16 },
  submitBtn: {
    width: '100%',
    backgroundColor: '#14B8A6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { paddingVertical: 12 },
  skipBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
});
