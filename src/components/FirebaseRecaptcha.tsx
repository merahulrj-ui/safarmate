import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, StyleSheet, Platform, Modal, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
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
    const [visible, setVisible] = React.useState(false);

    useImperativeHandle(ref, () => ({
      sendOTP: (phoneNumber: string) => {
        setVisible(true);
        // Add a slight delay to ensure Modal is rendered and WebView is ready
        setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              try {
                if (window.sendFirebaseOTP) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'Calling sendFirebaseOTP...' }));
                  window.sendFirebaseOTP('${phoneNumber}');
                } else {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Recaptcha script not loaded yet. Try again.' }));
                }
              } catch (e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'WebView JS Error: ' + e.toString() }));
              }
              true;
            `);
          }
        }, 1000);
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
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'Firebase Initialized in WebView' }));
          
          try {
            window.appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
              'size': 'invisible',
              'callback': (response) => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'reCAPTCHA solved' }));
              },
              'expired-callback': () => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'reCAPTCHA expired' }));
              }
            });
            window.appVerifier.render().then(() => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'reCAPTCHA rendered successfully' }));
            }).catch(e => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Render Error: ' + e.message }));
            });
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Setup Error: ' + e.message }));
          }

          window.sendFirebaseOTP = function(phoneNumber) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'Executing signInWithPhoneNumber' }));
            auth.signInWithPhoneNumber(phoneNumber, window.appVerifier)
              .then((confirmationResult) => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'SMS Sent Successfully' }));
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'success', 
                  verificationId: confirmationResult.verificationId 
                }));
              })
              .catch((error) => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', message: 'signInWithPhoneNumber Error: ' + error.code }));
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'error', 
                  message: error.code + ': ' + error.message 
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
        if (data.type === 'debug') {
          console.log('[WebView Debug]:', data.message);
        } else if (data.type === 'success') {
          console.log('[WebView Success]: Got verification ID');
          setVisible(false);
          onVerificationId(data.verificationId);
        } else if (data.type === 'error') {
          console.error('[WebView Error]:', data.message);
          setVisible(false);
          onError(data.message);
        }
      } catch (e) {
        console.error('[WebView Parse Error]:', event.nativeEvent.data);
        setVisible(false);
        onError('Failed to parse WebView message');
      }
    };

    return (
      <Modal visible={visible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.webviewContainer}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Security Check</Text>
              <TouchableOpacity onPress={() => { setVisible(false); onError("Cancelled"); }}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent, baseUrl: 'https://' + firebaseConfig.authDomain }}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
            />
          </View>
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webviewContainer: {
    width: '90%',
    height: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9fafb'
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  loader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)'
  }
});

export default FirebaseRecaptcha;
