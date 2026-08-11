import { showAlert } from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function PreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [preferences, setPreferences] = useState<any>({
    chattiness: 'I love to chat',
    music: 'I listen to music',
    smoking: 'No smoking please',
    pets: 'I love pets',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().travelPreferences) {
            setPreferences(userDoc.data().travelPreferences);
          }
        } catch (e) {
        }
      };
      fetchUserData();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        travelPreferences: preferences,
      });
      if (Platform.OS !== 'web') {
        showAlert('Success', 'Preferences updated successfully!');
      }
      router.navigate('/profile');
    } catch (e) {
      if (Platform.OS !== 'web') {
        showAlert('Error', 'Failed to update preferences.');
      } else {
        showAlert("Notification", 'Failed to update preferences.');
      }
    } finally {
      setLoading(false);
    }
  };

  const OptionSelector = ({ title, icon, options, value, onChange }: any) => (
    <View style={styles.optionContainer}>
      <View style={styles.optionHeader}>
        <FontAwesome5 name={icon} size={18} color="#4B5563" style={{ width: 24 }} />
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <View style={styles.chipsContainer}>
        {options.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && styles.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Travel Preferences</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoDesc}>
            Let others know what kind of travel companion you are. This helps match you with like-minded people.
          </Text>
        </View>

        <OptionSelector
          title="Chattiness"
          icon="comments"
          options={["I'm quiet", "I love to chat", "Depends on my mood"]}
          value={preferences.chattiness}
          onChange={(val: string) => setPreferences({...preferences, chattiness: val})}
        />

        <OptionSelector
          title="Music"
          icon="music"
          options={["Silence please", "I listen to music", "I love a good playlist"]}
          value={preferences.music}
          onChange={(val: string) => setPreferences({...preferences, music: val})}
        />

        <OptionSelector
          title="Smoking"
          icon="smoking-ban"
          options={["No smoking please", "Cigarette breaks outside", "Smoking is fine"]}
          value={preferences.smoking}
          onChange={(val: string) => setPreferences({...preferences, smoking: val})}
        />

        <OptionSelector
          title="Pets"
          icon="paw"
          options={["No pets please", "I love pets"]}
          value={preferences.pets}
          onChange={(val: string) => setPreferences({...preferences, pets: val})}
        />

        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Preferences'}</Text>
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
    marginBottom: 32,
  },
  infoDesc: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  optionContainer: {
    marginBottom: 32,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginLeft: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#065F46',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});
