import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, addDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const notificationSentRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }
      
      if (firebaseUser) {
        unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), 
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUserData(data);
              
              // Automatically send a notification if a verification is completed but not notified yet
              const updates: any = {};
              if (firebaseUser.emailVerified && !data.emailVerificationNotified && !notificationSentRef.current[`email_${firebaseUser.uid}`]) {
                notificationSentRef.current[`email_${firebaseUser.uid}`] = true;
                addDoc(collection(db, 'notifications'), {
                  userId: firebaseUser.uid,
                  title: "Email Verified",
                  body: "Your email address has been successfully verified. You now have a verified email badge on your profile!",
                  createdAt: new Date().toISOString(),
                  read: false,
                  type: 'system'
                }).catch(() => {});
                updates.emailVerificationNotified = true;
              }
              if (data.govtIdStatus === 'verified' && !data.govtIdVerificationNotified && !notificationSentRef.current[`govtId_${firebaseUser.uid}`]) {
                notificationSentRef.current[`govtId_${firebaseUser.uid}`] = true;
                addDoc(collection(db, 'notifications'), {
                  userId: firebaseUser.uid,
                  title: "Govt ID Verified",
                  body: "Your Government ID has been verified successfully. Your profile is now trusted!",
                  createdAt: new Date().toISOString(),
                  read: false,
                  type: 'system'
                }).catch(() => {});
                updates.govtIdVerificationNotified = true;
              }
              if (data.phone && !data.phoneVerificationNotified && !notificationSentRef.current[`phone_${firebaseUser.uid}`]) {
                notificationSentRef.current[`phone_${firebaseUser.uid}`] = true;
                addDoc(collection(db, 'notifications'), {
                  userId: firebaseUser.uid,
                  title: "Phone Verified",
                  body: "Your phone number has been successfully verified.",
                  createdAt: new Date().toISOString(),
                  read: false,
                  type: 'system'
                }).catch(() => {});
                updates.phoneVerificationNotified = true;
              }

              if (Object.keys(updates).length > 0) {
                updateDoc(doc(db, 'users', firebaseUser.uid), updates).catch(() => {});
              }

            } else {
              setUserData(null);
            }
            setLoading(false);
          },
          (error) => {
            setLoading(false);
          }
        );
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const value = useMemo(() => ({ user, userData, loading }), [user, userData, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
