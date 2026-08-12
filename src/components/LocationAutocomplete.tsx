import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, ScrollView, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';

interface Location {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationAutocompleteProps {
  placeholder: string;
  value: string;
  onChange: (val: string, lat?: string, lon?: string) => void;
  icon?: React.ReactNode;
}

export default function LocationAutocomplete({ placeholder, value, onChange, icon }: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasTyped = useRef(false);

  useEffect(() => {
    if (value !== query && !hasTyped.current) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        
        const mapped = data.features.map((f: any) => {
          const p = f.properties;
          const parts = [p.name, p.street, p.city, p.state, p.country].filter(Boolean);
          const uniqueParts = Array.from(new Set(parts));
          return {
            display_name: uniqueParts.join(', '),
            lat: f.geometry.coordinates[1].toString(),
            lon: f.geometry.coordinates[0].toString()
          };
        });

        setResults(mapped);
        if (mapped.length > 0 && hasTyped.current) {
          setIsOpen(true);
        }
      } catch (error) {
        // Fallback
        const CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Roorkee', 'Dehradun', 'Haridwar', 'Chandigarh'];
        const matched = CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));
        const fallbackData = matched.map(c => ({ display_name: `${c}, India`, lat: '0', lon: '0' }));
        setResults(fallbackData);
        if (fallbackData.length > 0 && hasTyped.current) {
          setIsOpen(true);
        }
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (query.length > 2 && hasTyped.current) {
        fetchLocations();
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (loc: Location) => {
    const parts = loc.display_name.split(',');
    const shortName = parts.length > 0 ? parts[0].trim() : loc.display_name;
    
    hasTyped.current = false;
    setQuery(shortName);
    setIsOpen(false);
    onChange(shortName, loc.lat, loc.lon);
  };

  const handleCurrentLocation = async () => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude.toString();
      const lon = location.coords.longitude.toString();

      // Reverse geocoding using Photon
      const res = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`);
      const data = await res.json();
      
      let cityName = 'Current Location';
      if (data.features && data.features.length > 0) {
        const p = data.features[0].properties;
        cityName = p.city || p.name || p.state || 'Current Location';
      }

      hasTyped.current = false;
      setQuery(cityName);
      onChange(cityName, lat, lon);
    } catch (e) {
      Alert.alert('Error', 'Could not get current location');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    hasTyped.current = true;
    setQuery(text);
    if (!text || text.trim() === '') {
      onChange('', '', '');
    }
  };

  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <TextInput
        style={styles.textInput}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        value={query}
        onChangeText={handleInputChange}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        maxLength={100}
      />
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#10B981" />
        </View>
      ) : (
        <TouchableOpacity style={styles.loaderContainer} onPress={handleCurrentLocation}>
          <Feather name="navigation" size={16} color="#3B82F6" />
        </TouchableOpacity>
      )}

      {isOpen && results.length > 0 && (
        <ScrollView 
          style={styles.dropdownContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.map((loc, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[styles.resultItem, idx === results.length - 1 && styles.lastResultItem]}
              onPress={() => handleSelect(loc)}
            >
              <Text style={styles.resultTitle}>{loc.display_name.split(',')[0]}</Text>
              <Text style={styles.resultSubtitle} numberOfLines={1}>{loc.display_name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    zIndex: 100, // Important for overlapping
    position: 'relative',
  },
  iconContainer: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
    fontFamily: 'Outfit_600SemiBold',
    height: 30, // giving fixed height helps with alignment
  },
  loaderContainer: {
    position: 'absolute',
    right: 0,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: -20, // Negative margins to match the parent container padding (20px in index.tsx)
    right: -20,
    marginTop: 14, // Space below input (which is the input row padding bottom)
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 250,
    zIndex: 999, // Ensure it sits on top of everything
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' as any,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
      }
    })
  },
  resultItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastResultItem: {
    borderBottomWidth: 0,
  },
  resultTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  }
});
