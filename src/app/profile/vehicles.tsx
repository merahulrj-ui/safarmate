import { showAlert } from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

export default function VehiclesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // New vehicle form state
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().vehicles) {
            setVehicles(userDoc.data().vehicles);
          }
        } catch (e) {
        }
      };
      fetchUserData();
    }
  }, [user]);

  const handleSaveVehicle = async () => {
    if (!make || !model || !color) {
      showAlert("Notification", 'Please fill all fields');
      return;
    }
    
    if (!user) return;
    setLoading(true);
    try {
      const newVehicle = { id: Date.now().toString(), make, model, color };
      const updatedVehicles = [...vehicles, newVehicle];
      
      await updateDoc(doc(db, 'users', user.uid), {
        vehicles: updatedVehicles,
      });
      
      setVehicles(updatedVehicles);
      setIsAdding(false);
      setMake('');
      setModel('');
      setColor('');
      
    } catch (e) {
      showAlert("Notification", 'Failed to add vehicle.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    
    const executeDelete = async () => {
      try {
        const updatedVehicles = vehicles.filter(v => v.id !== id);
        await setDoc(doc(db, 'users', user.uid), {
          vehicles: updatedVehicles,
        }, { merge: true });
        setVehicles(updatedVehicles);
      } catch (e) {
        showAlert("Notification", 'Failed to delete vehicle.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this vehicle?')) {
        executeDelete();
      }
    } else {
      Alert.alert('Delete Vehicle', 'Are you sure you want to delete this vehicle?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: executeDelete }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Vehicles</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {vehicles.length === 0 && !isAdding && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <FontAwesome5 name="car" size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No vehicles yet</Text>
            <Text style={styles.emptyDesc}>Add a vehicle to publish rides and start carpooling as a driver.</Text>
          </View>
        )}

        {!isAdding && vehicles.map((v) => (
          <View key={v.id} style={styles.vehicleCard}>
            <View style={styles.vehicleInfo}>
              <View style={styles.carIconBg}>
                <FontAwesome5 name="car-side" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.vehicleName}>{v.make} {v.model}</Text>
                <Text style={styles.vehicleColor}>{v.color}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDelete(v.id)} style={styles.deleteButton}>
              <Feather name="trash-2" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        {!isAdding ? (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setIsAdding(true)}
          >
            <Feather name="plus" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.addButtonText}>Add a vehicle</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Add New Vehicle</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Make (e.g. Maruti, Hyundai)</Text>
              <TextInput
                style={styles.input}
                value={make}
                onChangeText={setMake}
                placeholder="e.g. Maruti Suzuki"
                placeholderTextColor="#9CA3AF"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Model (e.g. Swift, i20)</Text>
              <TextInput
                style={styles.input}
                value={model}
                onChangeText={setModel}
                placeholder="e.g. Swift Dzire"
                placeholderTextColor="#9CA3AF"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g. White"
                placeholderTextColor="#9CA3AF"
                maxLength={30}
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setIsAdding(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSaveVehicle}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Vehicle'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFF',
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
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  vehicleCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  vehicleName: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  vehicleColor: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  formContainer: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Outfit_600SemiBold',
    backgroundColor: '#F9FAFB',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#10B981',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  }
});
