import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { firebaseConfig } from '../lib/firebase';

interface FirebaseRecaptchaProps {
  onVerificationId: (verificationId: string) => void;
  onError: (error: string) => void;
}

export interface FirebaseRecaptchaRef {
  sendOTP: (phoneNumber: string) => void;
}

const FirebaseRecaptcha = forwardRef<FirebaseRecaptchaRef, FirebaseRecaptchaProps>(
  ({ onVerificationId, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      sendOTP: (phoneNumber: string) => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.sendFirebaseOTP('${phoneNumber}');
            true;
          `);
        }
      },
    }));

    if (Platform.OS === 'web') {
      return <View id="recaptcha-container" style={{ display: 'none' }} />;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
        <style>
          body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: transparent; }
          #recaptcha-container { margin-top: 20px; }
        </style>
      </head>
      <body>
        <div id="recaptcha-container"></div>
        <script>
          const firebaseConfig = ${JSON.stringify(firebaseConfig)};
          firebase.initializeApp(firebaseConfig);
          const auth = firebase.auth();
          
          window.appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
              // reCAPTCHA solved
            },
            'expired-callback': () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'reCAPTCHA expired' }));
            }
          });

          // Initialize immediately so it's ready
          window.appVerifier.render();

          window.sendFirebaseOTP = function(phoneNumber) {
            auth.signInWithPhoneNumber(phoneNumber, window.appVerifier)
              .then((confirmationResult) => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'success', 
                  verificationId: confirmationResult.verificationId 
                }));
              })
              .catch((error) => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'error', 
                  message: error.message 
                }));
              });
          };
        </script>
      </body>
      </html>
    `;

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'success') {
          onVerificationId(data.verificationId);
        } else if (data.type === 'error') {
          onError(data.message);
        }
      } catch (e) {
        console.error('Failed to parse WebView message', e);
      }
    };

    return (
      <View style={styles.container} pointerEvents="none">
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent, baseUrl: 'https://' + firebaseConfig.authDomain }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ backgroundColor: 'transparent' }}
          originWhitelist={['*']}
          bounces={false}
          scrollEnabled={false}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: 0,
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
});

export default FirebaseRecaptcha;
