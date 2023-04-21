import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { initShield, Config, LogLevel, EnvironmentInfo, ShieldCallback, getSessionId, sendAttributes, isSDKready, getLatestDeviceResult } from 'react-native-shield-fraud-plugin'; // import the necessary types and functions from the ShieldFraudPlugin module

const App = () => {
  // Define the callback function
  const callbacks: ShieldCallback = {
    onSuccess: (data) => {
      // Handle success event here
      console.log('Success:', data);
    },
    onFailure: (error) => {
      // Handle failure event here
      console.log('Error:', error);
    },
  };

  const config: Config = {
    siteID: 'dda05c5ddac400e1c133a360e2714aada4cda052',
    secretKey: '9ce44f88a25272b6d9cbb430ebbcfcf1',
    blockedDialog: {
      title: 'Blocked Dialog Title',
      body: 'Blocked Dialog Body'
    }, // can be null also depending on your requirement,
    logLevel: LogLevel.LogLevelInfo,
    environmentInfo: EnvironmentInfo.EnvironmentProd
  };

  useEffect(() => {
    // Define the Config object


    // Call the initShield function with the Config object
    initShield(config, callbacks)
    isSDKready((isReady: boolean) => {
      console.log('SDK ready:', isReady);
      // Handle the callback logic here, e.g. dispatch Redux action, update UI state, etc.
      console.log('session::', getSessionId())
      sendAttributes('Home Page', { key1: 'value1', key2: 'value2' });


      getLatestDeviceResult()
        .then((result: object) => {
          // Handle success with the result object
          console.log('Received latest device result:', result);
        })
        .catch((error: object) => {
          // Handle error with the error object
          console.log('Error retrieving device result:', error);
        });
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Welcome to My App!</Text>
      <Text style={styles.sessionIdText}>Session ID: </Text>
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
