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
      // Use callbacks for logging and live SDK events, and use isSDKready()
      // as the single readiness gate for post-init work on both platforms.
      // ------------------------------------------------------------------
      const callbacks: ShieldCallback = {
        onSuccess: (data) => {
          console.log('[Shield] onSuccess:', data);
          setResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
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

      // Use the same SDK-ready gate on Android and iOS.
      ShieldFraud.isSDKready(async (isReady: boolean) => {
        if (isReady) {
          await runPostInitCalls();
        } else {
          console.log('[Shield] SDK is not ready');
        }
      });
    };

    // ------------------------------------------------------------------
    // Post-init calls — same logic for both platforms, called from
    // the shared isSDKready callback.
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
