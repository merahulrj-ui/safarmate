import { showAlert } from '@/utils/alert';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@/components/DateTimePicker';
import { BottomTabInset } from '@/constants/theme';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDoc } from 'firebase/firestore';

interface LoginScreenProps {
  asComponent?: boolean;
}

export default function LoginScreen({ asComponent = false }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email) {
      showAlert("Error", "Please enter your email address.");
      return;
    }
    
    setLoading(true);
    try {
      const emailLower = email.toLowerCase().trim();
      const securityRef = doc(db, 'login_security', emailLower);
      
      if (isLogin) {
        // Pre-login check
        const securitySnap = await getDoc(securityRef);
        if (securitySnap.exists()) {
          const data = securitySnap.data();
          if (data.blockedUntil && data.blockedUntil > Date.now()) {
            showAlert("Access Denied", "Your account has been temporarily locked due to too many failed login attempts. Please try again after 24 hours or contact support@safarmate.com.");
            setLoading(false);
            return;
          }
        }

        await signInWithEmailAndPassword(auth, emailLower, password);
        
        // Reset failed attempts on success
        await setDoc(securityRef, { failedAttempts: 0, blockedUntil: null }, { merge: true });
        showAlert("Notification", 'Logged in successfully!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name,
          gender,
          dob,
          email,
          createdAt: new Date().toISOString()
        });
        
        const newConvRef = await addDoc(collection(db, 'conversations'), {
          user: { id: 'team', name: 'SafarMate Team', avatar: 'https://ui-avatars.com/api/?name=SafarMate+Team&background=10B981&color=fff' },
          unreadCount: 1,
          unreadCounts: {
            [userCredential.user.uid]: 1
          },
          lastMessage: {
            senderId: 'team',
            content: 'Welcome to SafarMate! Start booking or publishing rides today.',
            createdAt: new Date().toISOString()
          },
          participants: [userCredential.user.uid, 'team']
        });
        

        
        showAlert("Notification", 'Account created successfully!');
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        if (isLogin) {
          const emailLower = email.toLowerCase().trim();
          const securityRef = doc(db, 'login_security', emailLower);
          
          const securitySnap = await getDoc(securityRef);
          let attempts = 1;
          if (securitySnap.exists()) {
            attempts = (securitySnap.data().failedAttempts || 0) + 1;
          }
          
          if (attempts >= 3) {
            const blockedUntil = Date.now() + 24 * 60 * 60 * 1000;
            await setDoc(securityRef, { failedAttempts: attempts, blockedUntil }, { merge: true });
            showAlert("Access Denied", "Your account has been temporarily locked due to too many failed login attempts. Please try again after 24 hours or contact support@safarmate.com.");
          } else {
            await setDoc(securityRef, { failedAttempts: attempts }, { merge: true });
            showAlert("Error", `Invalid email or password. You have ${3 - attempts} attempt(s) left.`);
          }
        } else {
          showAlert("Error", "Invalid email or password. Please try again.");
        }
      } else if (error.code === 'auth/email-already-in-use') {
        showAlert("Error", "This email is already registered. Please log in instead.");
      } else if (error.code === 'auth/weak-password') {
        showAlert("Error", "Password should be at least 6 characters.");
      } else {
        showAlert("Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showAlert("Error", "Please enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert("Email Sent", `A password reset link has been sent to ${email}. Please check your inbox.`);
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <View style={styles.formContainer}>
      <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create an account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Log in to your SafarMate account.' : 'Sign up for a new SafarMate account.'}
          </Text>

          <View style={styles.form}>
            {!isLogin && (
              <>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    maxLength={50}
                  />
                </View>
                <View style={[styles.inputWrapper, { zIndex: 50, elevation: 50 }]}>
                  <DateTimePicker
                    type="date"
                    value={dob}
                    onChange={setDob}
                    placeholder="Date of Birth"
                  />
                </View>

                <View>
                  <Text style={styles.genderLabel}>Gender</Text>
                  <View style={styles.genderRow}>
                    {['Male', 'Female', 'Prefer not to say'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderChip, gender === g && styles.genderChipActive]}
                        onPress={() => setGender(g)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                maxLength={100}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                maxLength={50}
              />
            </View>

            {isLogin && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 8, marginTop: 8 }}>
                <Text style={{ color: '#10B981', fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[
                styles.submitButton, 
                (loading || !email || password.length < 6 || (!isLogin && (!name || !gender || !dob))) && styles.submitButtonDisabled
              ]}
              onPress={handleAuth}
              disabled={loading || !email || password.length < 6 || (!isLogin && (!name || !gender || !dob))}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
              </Text>
            </TouchableOpacity>
          </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleText}>
          {isLogin ? "Not a member yet? " : "Already have an account? "}
        </Text>
        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleLink}>{isLogin ? "Sign up" : "Log in"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (asComponent) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.bgGradientTop} />
      <View style={styles.bgGradientBottom} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          {content}
          <View style={{ height: BottomTabInset + 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  bgGradientTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    backgroundColor: '#34D399',
    opacity: 0.1,
    borderRadius: 150,
  },
  bgGradientBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: '#3B82F6',
    opacity: 0.1,
    borderRadius: 150,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 30px rgba(0,0,0,0.06)' as any,
        backdropFilter: 'blur(20px)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 15,
        elevation: 4,
      }
    }),
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
  },
  inputWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#0F172A',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    color: '#64748B',
  },
  toggleLink: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#10B981',
  },
  genderLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#64748B',
    marginBottom: 8,
    paddingLeft: 4,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  genderChipActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  genderChipText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    color: '#64748B',
  },
  genderChipTextActive: {
    color: '#059669',
    fontFamily: 'Outfit_700Bold',
  },
});
