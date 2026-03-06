import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ShieldFraud, {
  LogLevel,
  Config,
  EnvironmentInfo,
  ShieldCallback,
} from 'react-native-shield-fraud-plugin';

const App = () => {
  const [sessionId, setSessionId] = useState('');
  const [successResult, setSuccessResult] = useState('');

  // Ref used inside the effect to check whether a device result has already
  // been received, without adding successResult to the dependency array
  // (which would cause the effect to re-run on every result update).
  const hasResultRef = useRef(false);

  useEffect(() => {
    // Define config and callbacks inside the effect so they are stable
    // for this single mount-time run and satisfy exhaustive-deps.
    const callbacks: ShieldCallback = {
      onSuccess: (data) => {
        console.log('Callback Success:', data);
        setSuccessResult(JSON.stringify(data, null, 2));
      },
      onFailure: (error) => {
        console.log('Callback Failure:', error);
        setSuccessResult(error);
      },
    };

    const config: Config = {
      siteID: 'SHIELD_SITE_ID',
      secretKey: 'SHIELD_SECRET_KEY',
      blockedDialog: {
        title: 'Blocked Dialog Title',
        body: 'Blocked Dialog Body',
      }, // can be null also depending on your requirement
      logLevel: LogLevel.LogLevelInfo,
      environmentInfo: EnvironmentInfo.EnvironmentProd,
    };

    const initializeShield = async () => {
      await ShieldFraud.initShield(config, callbacks);

      ShieldFraud.isSDKready(async (isReady: boolean) => {
        if (isReady) {
          console.log('SDK ready for sendAttributes:', isReady);
          ShieldFraud.sendAttributes('Home', { userid: 'userid' });
        } else {
          console.log('SDK is not ready for sendAttributes');
        }
      });

      ShieldFraud.isSDKready(async (isReady: boolean) => {
        if (isReady) {
          console.log('SDK ready for sessionID:', isReady);
          const sessionID = await ShieldFraud.getSessionId();
          setSessionId(sessionID);
        } else {
          console.log('SDK is not ready for sessionID');
        }
      });

      ShieldFraud.isSDKready(async (isReady: boolean) => {
        if (isReady) {
          console.log('SDK ready for getLatestDeviceResult:', isReady);

          ShieldFraud.getLatestDeviceResult()
            .then((result: object) => {
              if (!hasResultRef.current) {
                hasResultRef.current = true;
                console.log('Received latest device result:', result);
                setSuccessResult(JSON.stringify(result, null, 2));
              }
            })
            .catch((error: object) => {
              console.log('Error retrieving device result:', error);
            });
        } else {
          console.log('SDK is not ready for getLatestDeviceResult');
        }
      });
    };

    initializeShield();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.terminalContainer}>
        <Text style={styles.terminalText}>$ Welcome to My App!</Text>
        <Text style={styles.terminalText}>$ session id - {sessionId}</Text>
        <Text style={styles.terminalText}>$ Result - {successResult}</Text>
      </View>
      {/* Additional UI components for your app */}
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
