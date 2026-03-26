import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import ShieldFraud, {
  Config,
  EnvironmentInfo,
  LogLevel,
  ShieldCallback,
} from 'react-native-shield-fraud-plugin';

const App = () => {
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    const initializeShield = async () => {
      // ------------------------------------------------------------------
      // On Android (SDK 2.x) — callbacks.onSuccess / onFailure fire from
      // the createShieldWithCallback Sentinel automatically. Use them for
      // all post-init work.
      //
      // On iOS (SDK 1.x) — callbacks fire from registerDeviceShieldCallback.
      // isSDKready() is used separately to gate sendAttributes etc.
      // ------------------------------------------------------------------
      const callbacks: ShieldCallback = {
        onSuccess: async (data) => {
          console.log('[Shield] onSuccess:', data);
          setResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));

          if (Platform.OS === 'android') {
            // Android: SDK is ready at this point — run all post-init calls here.
            await runPostInitCalls();
          }
        },
        onFailure: (error) => {
          console.log('[Shield] onFailure:', error);
          setResult(String(error));
        },
      };

      const config: Config = {
        siteID: 'SHIELD_SITE_ID',
        secretKey: 'SHIELD_SECRET_KEY',
        blockedDialog: {
          title: 'Blocked Dialog Title',
          body: 'Blocked Dialog Body',
        },
        logLevel: LogLevel.LogLevelInfo,
        environmentInfo: EnvironmentInfo.EnvironmentProd,
        blockScreenRecording: false, // Android-only, ignored on iOS
      };

      await ShieldFraud.initShield(config, callbacks);

      if (Platform.OS === 'ios') {
        // iOS: use isSDKready to gate post-init calls — fires after
        // the SDK signals readiness via setDeviceResultStateListener.
        ShieldFraud.isSDKready(async (isReady: boolean) => {
          if (isReady) {
            await runPostInitCalls();
          } else {
            console.log('[Shield] SDK is not ready');
          }
        });
      }
    };

    // ------------------------------------------------------------------
    // Post-init calls — same logic for both platforms, called from
    // onSuccess (Android) or isSDKready callback (iOS).
    // ------------------------------------------------------------------
    const runPostInitCalls = async () => {
      // Session ID
      const sid = await ShieldFraud.getSessionId();
      console.log('[Shield] sessionId:', sid);
      setSessionId(sid);

      // sendAttributes (fire-and-forget)
      ShieldFraud.sendAttributes('Home', { userid: 'userid' });

      // sendAttributesWithCallback
      try {
        const didSend = await ShieldFraud.sendAttributesWithCallback(
          'HomeWithCallback',
          { userid: 'userid-callback' }
        );
        console.log('[Shield] sendAttributesWithCallback success:', didSend);
      } catch (error) {
        console.log('[Shield] sendAttributesWithCallback failure:', error);
      }

      // getLatestDeviceResult
      try {
        const deviceResult = await ShieldFraud.getLatestDeviceResult();
        console.log('[Shield] getLatestDeviceResult:', deviceResult);
        setResult(JSON.stringify(deviceResult, null, 2));
      } catch (error) {
        console.log('[Shield] getLatestDeviceResult error:', error);
      }

      // sendDeviceSignature
      try {
        const signatureResult = await ShieldFraud.sendDeviceSignature('Home');
        console.log('[Shield] sendDeviceSignature:', signatureResult);
        setResult(JSON.stringify(signatureResult, null, 2));
      } catch (error) {
        console.log('[Shield] sendDeviceSignature error:', error);
      }
    };

    initializeShield();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.terminalContainer}>
        <Text style={styles.terminalText}>$ Welcome to Shield Example!</Text>
        <Text style={styles.terminalText}>$ platform    - {Platform.OS}</Text>
        <Text style={styles.terminalText}>$ session id  - {sessionId}</Text>
        <Text style={styles.terminalText}>$ result      - {result}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  terminalContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'black',
    borderWidth: 1,
    borderColor: 'white',
    maxWidth: '80%',
  },
  terminalText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
  },
});

export default App;
