import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, UIManager, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Legacy LayoutAnimation enabler removed (no-op in New Architecture)

const FAQS = [
  {
    category: 'Booking & Passengers',
    icon: 'users',
    questions: [
      { q: "How do I cancel a booking?", a: "You can cancel a booking from the 'Your Rides' tab. Go to History, select your active ride, scroll to the bottom, and tap 'Cancel My Booking'." },
      { q: "How do payments and refunds work?", a: "SafarMile currently connects passengers and drivers. All payments are made directly to the driver (via Cash or UPI) during the ride. We do not charge online cancellation fees or hold refunds." },
      { q: "How much luggage can I bring?", a: "Generally, one medium bag is allowed per passenger. If you have extra or oversized luggage, you must message the driver before booking to confirm." },
    ]
  },
  {
    category: 'Driving & Publishing',
    icon: 'navigation',
    questions: [
      { q: "How do I edit my ride details?", a: "Currently, if you need to change route or date, it is best to cancel the published ride from 'Your Rides' and publish a new one to avoid passenger confusion." },
      { q: "What if a passenger is a no-show?", a: "Wait for at least 10-15 minutes and try calling them or using the in-app chat. If they are unreachable, you can cancel their booking and proceed." },
      { q: "When do I receive my payments?", a: "SafarMile does not hold your money! You will receive payments directly from your passengers via Cash or UPI during or at the end of the journey." }
    ]
  },
  {
    category: 'Trust & Safety',
    icon: 'shield',
    questions: [
      { q: "Why verify my Govt ID?", a: "Verification keeps SafarMile secure. Profiles with a green 'Verified' badge get 3x more bookings because they build trust in the community." },
      { q: "How do I report bad behavior?", a: "Safety is our absolute priority. You can report a user directly from their profile page or by contacting our support team." },
      { q: "What is the smoking/music policy?", a: "The driver sets the rules for their car. Always check the ride details or ask the driver politely before playing music or smoking." }
    ]
  }
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === id ? null : id);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@safarmile.com?subject=SafarMile%20Support%20Request');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Hi, how can we help?</Text>
        <Text style={styles.subtitle}>Find answers to the most common questions below.</Text>

        {FAQS.map((category, catIndex) => (
          <View key={catIndex} style={styles.categoryContainer}>
            <View style={styles.categoryHeader}>
              <Feather name={category.icon as any} size={20} color="#10B981" />
              <Text style={styles.categoryTitle}>{category.category}</Text>
            </View>

            {category.questions.map((item, qIndex) => {
              const id = `${catIndex}-${qIndex}`;
              const isExpanded = expandedIndex === id;
              return (
                <View key={id} style={styles.faqCard}>
                  <TouchableOpacity 
                    style={styles.questionRow} 
                    onPress={() => toggleExpand(id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.questionText, isExpanded && { color: '#10B981' }]}>{item.q}</Text>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={isExpanded ? "#10B981" : "#6B7280"} />
                  </TouchableOpacity>
                  {isExpanded && (
                    <Text style={styles.answerText}>{item.a}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.contactContainer}>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSubtitle}>Our support team is here for you.</Text>
          <TouchableOpacity style={styles.contactButton} onPress={handleContactSupport}>
            <Feather name="mail" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.contactButtonText}>Email Support</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Softer grey background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
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
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Outfit_400Regular',
    marginBottom: 32,
  },
  categoryContainer: {
    marginBottom: 32,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginLeft: 12,
  },
  faqCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  questionText: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#1F2937',
    flex: 1,
    paddingRight: 16,
    lineHeight: 22,
  },
  answerText: {
    fontSize: 15,
    color: '#4B5563',
    fontFamily: 'Outfit_400Regular',
    paddingHorizontal: 20,
    paddingBottom: 20,
    lineHeight: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  contactContainer: {
    marginTop: 24,
    backgroundColor: '#111827', // Dark premium box
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  contactTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
    marginBottom: 8,
  },
  contactSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Outfit_400Regular',
    marginBottom: 24,
    textAlign: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  contactButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  }
});
