import React, { useState } from 'react';
import { TextInput, StyleSheet, Platform, View, TouchableOpacity, Text } from 'react-native';
import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface DateTimePickerProps {
  type: 'date' | 'time';
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  min?: string;
}

function toLocalYMD(val: string): string {
  if (!val) return '';
  if (val.includes('T') || val.endsWith('Z')) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return val;
}

function formatDisplayDate(val: string, type: 'date' | 'time'): string {
  if (!val) return '';
  if (type === 'time') return val;
  
  // val is expected to be YYYY-MM-DD
  const parts = val.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}, ${d.getFullYear()}`;
    }
  }
  return val;
}

export default function DateTimePicker({ type, value, onChange, placeholder, min }: DateTimePickerProps) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    const displayValue = type === 'date' ? toLocalYMD(value) : (value || '');
    const displayMin   = type === 'date' ? toLocalYMD(min || '') : (min || '');

    return (
      <View style={{ width: '100%' }}>
        <input
          type={type}
          value={displayValue}
          min={displayMin || undefined}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) { onChange(val); return; }
            // Block past dates/times via string comparison
            if (displayMin && val < displayMin) {
              onChange(displayMin);
              return;
            }
            onChange(val);
          }}
          placeholder={placeholder}
          style={{
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '14px',
            paddingBottom: '14px',
            fontSize: '16px',
            fontFamily: 'Outfit_600SemiBold',
            color: '#111827',
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if ('showPicker' in HTMLInputElement.prototype) {
              try { (e.target as any).showPicker(); } catch (err) {}
            }
          }}
        />
      </View>
    );
  }

  let initialDate = new Date();
  if (value) {
    if (type === 'date') {
      const parts = value.split('-');
      if (parts.length === 3) {
        initialDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    } else if (type === 'time') {
      const parts = value.split(':');
      if (parts.length === 2) {
        initialDate.setHours(parseInt(parts[0]));
        initialDate.setMinutes(parseInt(parts[1]));
      }
    }
  }

  let minDate = undefined;
  if (min && type === 'date') {
    const parts = min.split('-');
    if (parts.length === 3) {
      minDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  const handleValueChange = (selectedDate: any) => {
    if (Platform.OS === 'android') setShow(false);
    
    // In case some older versions pass (event, date) to onValueChange
    const actualDate = (selectedDate && selectedDate.nativeEvent) 
      ? new Date(selectedDate.nativeEvent.timestamp) 
      : (selectedDate instanceof Date ? selectedDate : null);

    if (actualDate) {
      if (type === 'date') {
        const y = actualDate.getFullYear();
        const m = String(actualDate.getMonth() + 1).padStart(2, '0');
        const d = String(actualDate.getDate()).padStart(2, '0');
        onChange(`${y}-${m}-${d}`);
      } else {
        const h = String(actualDate.getHours()).padStart(2, '0');
        const m = String(actualDate.getMinutes()).padStart(2, '0');
        onChange(`${h}:${m}`);
      }
    }
  };

  const handleDismiss = () => {
    if (Platform.OS === 'android') setShow(false);
  };

  return (
    <View style={{ width: '100%' }}>
      <TouchableOpacity onPress={() => setShow(true)} activeOpacity={0.7} style={styles.input}>
        <Text style={{ color: value ? '#111827' : '#9CA3AF', fontSize: 16, fontFamily: 'Outfit_600SemiBold' }}>
          {value ? formatDisplayDate(value, type) : (placeholder || (type === 'date' ? "Select Date" : "Select Time"))}
        </Text>
      </TouchableOpacity>
      
      {show && (
        <RNDateTimePicker
          value={initialDate}
          mode={type}
          display="default"
          minimumDate={minDate}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    justifyContent: 'center',
  }
});
