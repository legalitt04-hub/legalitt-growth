import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { firAPI, uploadAPI } from '../../services/api';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const FIRFormScreen = ({ route, navigation }) => {
  const { isAuthenticated } = useAuth();
  const { type, title } = route.params;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    type: type,
    incident: { date: '', time: '', location: '', description: '' },
    complainant: { name: '', age: '', address: '', contact: '' },
    accused: [{ name: '', address: '', description: '' }],
    witnesses: [{ name: '', contact: '' }],
    additionalInfo: ''
  });

  const updateNested = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const addArrayItem = (field, initialValue) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], initialValue]
    }));
  };

  const updateArrayItem = (field, index, key, value) => {
    const newArr = [...formData[field]];
    newArr[index] = { ...newArr[index], [key]: value };
    setFormData(prev => ({ ...prev, [field]: newArr }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.incident.location || !formData.incident.description) {
        Alert.alert('Required', 'Please provide location and description of the incident.');
        return false;
      }
    }
    if (step === 2) {
      if (!formData.complainant.name || !formData.complainant.address) {
        Alert.alert('Required', 'Please provide your name and address.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    if (validateStep()) {
      if (step < 3) setStep(s => s + 1);
      else handleSubmit();
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (result.canceled) return;
      
      const file = result.assets[0];
      setLoading(true);

      const response = await uploadAPI.uploadFile(file.uri, file.name, file.mimeType || 'application/octet-stream');

      if (response.data.success) {
        addArrayItem('evidence', { name: file.name, url: response.data.data.url, type: file.mimeType });
        Alert.alert('Success', 'Evidence uploaded successfully.');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Failed to upload document.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    setLoading(true);
    try {
      const response = await firAPI.generate(formData);
      if (response.data.success) {
        navigation.navigate('FIRPreview', { draft: response.data.data });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate FIR draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1: // Incident Details
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Incident Details</Text>
            <Text style={styles.inputLabel}>Date of Incident</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 2024-05-14" 
              value={formData.incident.date} 
              onChangeText={(v) => updateNested('incident', 'date', v)}
            />
            
            <Text style={styles.inputLabel}>Time</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 10:30 PM" 
              value={formData.incident.time} 
              onChangeText={(v) => updateNested('incident', 'time', v)}
            />

            <Text style={styles.inputLabel}>Exact Location</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Full address of incident" 
              value={formData.incident.location} 
              onChangeText={(v) => updateNested('incident', 'location', v)}
            />

            <Text style={styles.inputLabel}>Description (Important)</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Explain exactly what happened..." 
              multiline 
              numberOfLines={5}
              value={formData.incident.description} 
              onChangeText={(v) => updateNested('incident', 'description', v)}
            />
          </View>
        );
      case 2: // Complainant Info
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Details</Text>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput 
              style={styles.input} 
              value={formData.complainant.name} 
              onChangeText={(v) => updateNested('complainant', 'name', v)}
            />
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput 
              style={styles.input} 
              keyboardType="numeric"
              value={formData.complainant.age} 
              onChangeText={(v) => updateNested('complainant', 'age', v)}
            />
            <Text style={styles.inputLabel}>Full Address</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              multiline
              value={formData.complainant.address} 
              onChangeText={(v) => updateNested('complainant', 'address', v)}
            />
          </View>
        );
      case 3: // Accused & Witnesses
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Accused & Witnesses</Text>
            
            <Text style={styles.sectionHeader}>Accused Details</Text>
            {formData.accused.map((a, idx) => (
              <View key={idx} style={styles.arrayBox}>
                <TextInput 
                  style={styles.input} 
                  placeholder="Name (if known)" 
                  value={a.name}
                  onChangeText={(v) => updateArrayItem('accused', idx, 'name', v)}
                />
                <TextInput 
                  style={styles.input} 
                  placeholder="Description / Appearance" 
                  value={a.description}
                  onChangeText={(v) => updateArrayItem('accused', idx, 'description', v)}
                />
              </View>
            ))}
            <TouchableOpacity onPress={() => addArrayItem('accused', { name: '', address: '', description: '' })}>
              <Text style={styles.addBtn}>+ Add Accused</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Witnesses</Text>
            {formData.witnesses.map((w, idx) => (
              <View key={idx} style={styles.arrayBox}>
                <TextInput 
                  style={styles.input} 
                  placeholder="Witness Name" 
                  value={w.name}
                  onChangeText={(v) => updateArrayItem('witnesses', idx, 'name', v)}
                />
              </View>
            ))}
            <TouchableOpacity onPress={() => addArrayItem('witnesses', { name: '', contact: '' })}>
              <Text style={styles.addBtn}>+ Add Witness</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark || '#8D7865']} style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title} FIR</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progress, { width: `${(step / 3) * 100}%` }]} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.nextBtn} 
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.nextBtnText}>{step === 3 ? 'Generate Draft' : 'Next'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 5, paddingBottom: 25, paddingHorizontal: 20 },
  headerInner: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginLeft: 15 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progress: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  scroll: { padding: 20, paddingBottom: 100 },
  stepContainer: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#334155' },
  textArea: { height: 100, textAlignVertical: 'top' },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },
  arrayBox: { marginBottom: 10, padding: 10, backgroundColor: '#f1f5f9', borderRadius: 12 },
  addBtn: { color: COLORS.primary, fontWeight: '600', marginTop: 5 },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9' },
  backBtn: { flex: 1, padding: 16, alignItems: 'center' },
  backBtnText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  nextBtn: { flex: 2, backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default FIRFormScreen;
