import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { initShield, getSessionId, Config, LogLevel, EnvironmentInfo } from 'react-native-shield-fraud-plugin';

const App = () => {
  const [sessionId, setSessionId] = useState('');

  // Define the onSuccess function
const onSuccess = (data: any) => {
  console.log('onSuccess:', data);
};

// Define the onError function
const onError = (error: any) => {
  console.log('onError:', error);
};

  useEffect(() => {
    // Define the Config object
    const config: Config = {
      siteID: 'dda05c5ddac400e1c133a360e2714aada4cda052',
      secretKey: '9ce44f88a25272b6d9cbb430ebbcfcf1',
      isOptimizedListener: true, // or false, depending on your requirement
      blockedDialog: {
        title: 'Blocked Dialog Title',
        body: 'Blocked Dialog Body'
      }, // can be null also depending on your requirement,
      logLevel: LogLevel.LogLevelInfo,
      environmentInfo: EnvironmentInfo.EnvironmentProd
    };

    // Call the initShield function with the Config object
    initShield(config, onSuccess, onError)

    // Call getSessionId separately after initShield succeeds
    // getSessionId()
    //   .then(sessionId => {
    //     console.log('getSessionId success:', sessionId);
    //     setSessionId(sessionId); // Update session ID state
    //   })
    //   .catch(error => {
    //     console.error('ShieldFraudReactNativePlugin error:', error);
    //   });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Welcome to My App!</Text>
      <Text style={styles.sessionIdText}>Session ID: {sessionId}</Text>
      {/* Additional UI components for your app */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sessionIdText: {
    fontSize: 18,
    marginBottom: 16,
  },
});

export default App;
