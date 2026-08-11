import { showAlert } from '@/utils/alert';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as ImagePicker from 'expo-image-picker';

export default function VerifyIdScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [docType, setDocType] = useState('Aadhaar'); // 'Aadhaar', 'PAN', 'DL'
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3], // ID Card shape
        quality: 0.1, // Compress for speed
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Size Check (5MB = 5 * 1024 * 1024 bytes)
        const fileSize = result.assets[0].fileSize;
        if (fileSize && fileSize > 5 * 1024 * 1024) {
          showAlert('File Too Large', 'Please select a photo smaller than 5 MB.');
          return;
        }

        const uri = result.assets[0].uri;
        let finalUri = uri;
        
        if (result.assets[0].base64 && !uri.startsWith('data:')) {
            finalUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        }
        
        if (side === 'front') setFrontImage(finalUri);
        else setBackImage(finalUri);
      }
    } catch (error) {
      if (Platform.OS !== 'web') showAlert('Picker Error', String(error));
      else showAlert("Notification", 'Picker Error: ' + String(error));
    }
  };

  const handleSubmit = async () => {
    if (!frontImage || (docType !== 'PAN' && !backImage)) {
      const msg = docType === 'PAN' ? 'Please upload your PAN card photo.' : 'Please upload both front and back sides of your ID.';
      showAlert('Missing Info', msg);
      return;
    }

    setLoading(true);
    try {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.uid), {
        govtIdType: docType,
        pendingGovtIdFront: frontImage,
        pendingGovtIdBack: docType === 'PAN' ? null : backImage,
        govtIdStatus: 'pending'
      });
      
      showAlert("Success", 'ID submitted successfully. Awaiting verification.');
      router.navigate('/profile');
    } catch (error: any) {
      showAlert('Upload Error', 'Failed to submit ID. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify ID</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.infoBox}>
          <Feather name="shield" size={24} color="#10B981" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Secure & Private</Text>
            <Text style={styles.infoDesc}>Your ID is securely encrypted and only used to verify your identity. It will never be shared with other users.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Select ID Type</Text>
        <View style={styles.docTypeRow}>
          {['Aadhaar', 'PAN', 'DL'].map((type) => (
            <TouchableOpacity 
              key={type}
              style={[styles.docTypeChip, docType === type && styles.docTypeChipActive]}
              onPress={() => {
                setDocType(type);
                if (type === 'PAN') setBackImage(null); // Clear back image if switching to PAN
              }}
            >
              <Text style={[styles.docTypeText, docType === type && styles.docTypeTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Upload ID Cards</Text>
        <Text style={styles.sectionSubtitle}>Please provide clear photos of your {docType}.</Text>

        <View style={styles.uploadCards}>
          {/* Front Side */}
          <TouchableOpacity 
            style={[styles.uploadCard, frontImage && styles.uploadCardFilled]} 
            onPress={() => pickImage('front')}
            activeOpacity={0.7}
          >
            {frontImage ? (
              <Image source={{ uri: frontImage }} style={styles.uploadedImage} />
            ) : (
              <>
                <View style={styles.iconCircle}>
                  <Feather name="camera" size={24} color="#10B981" />
                </View>
                <Text style={styles.uploadTitle}>Front Side</Text>
                <Text style={styles.uploadSubtitle}>Tap to capture or upload</Text>
              </>
            )}
            {frontImage && (
              <View style={styles.editBadge}>
                <Feather name="edit-2" size={14} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Back Side - Hidden for PAN */}
          {docType !== 'PAN' && (
            <TouchableOpacity 
              style={[styles.uploadCard, backImage && styles.uploadCardFilled]} 
              onPress={() => pickImage('back')}
              activeOpacity={0.7}
            >
              {backImage ? (
                <Image source={{ uri: backImage }} style={styles.uploadedImage} />
              ) : (
                <>
                  <View style={styles.iconCircle}>
                    <Feather name="camera" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.uploadTitle}>Back Side</Text>
                  <Text style={styles.uploadSubtitle}>Tap to capture or upload</Text>
                </>
              )}
              {backImage && (
                <View style={styles.editBadge}>
                  <Feather name="edit-2" size={14} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit for Verification</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#065F46',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: '#047857',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  docTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  docTypeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  docTypeChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  docTypeText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: '#4B5563',
  },
  docTypeTextActive: {
    color: '#065F46',
  },
  uploadCards: {
    gap: 16,
    marginBottom: 32,
  },
  uploadCard: {
    height: 140,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  uploadCardFilled: {
    borderStyle: 'solid',
    borderColor: '#10B981',
    backgroundColor: '#FFF',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});
