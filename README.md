# React Native Shield Fraud Plugin

React Native Plugin for Shield Fraud (www.shield.com)

React Native Shield Fraud Plugin helps developers to assess malicious activities performed on mobile devices and return risk intelligence based on user's behaviour. It collects device's fingerprint, social metrics and network information. 

There are four steps to getting started with the SHIELD SDK:

1. [Integrate the SDK](#integrate-the-sdk)

2. [Initialize the SDK](#initialize-the-sdk)

3. [Get Session ID](#get-session-id)

4. [Get Device Results](#get-device-results)

5. [Send Custom Attributes](#send-custom-attributes)


### Integrate the SDK

This package can be installed in two ways, you can choose a way depends on your need.

**NPM:**
```
npm install react-native-shield-fraud-plugin
```
**OR**

**YARN:**
```
yarn add react-native-shield-fraud-plugin
```

**Note**: We make continuous enhancements to our fraud library and detection capabilities which includes new functionalities, bug fixes and security updates. We recommend updating to the latest SDK version to protect against rapidly evolving fraud risks.

You can refer to the Changelog to see more details about our updates.

### Initialize the SDK

The SDK initialization should be configured at the earliest of the App Lifecycle to ensure successful generation and processing of the device fingerprint. SDK is to be initialised only once and will throw an exception if it is initialised more than once.


You need both the SHIELD_SITE_ID and SHIELD_SECRET_KEY to initialize the SDK. You can locate them at the top of the page.

You can initialize the SDK by calling it inside UseEffect() 

```
const config: Config = {
   siteID: 'SHIELD_SITE_ID',
   secretKey: 'SHIELD_SECRET_KEY'
};

useEffect(() => {
    ShieldFraud.initShield(config)
}
```

`Config` has these **optional** parameters:

1. `logLevel` Set your log level to debug, info or none. | Receives high-level information about how the SDK processes network requests, responses or error information during SDK integration. Default log level is none. 
2. `environmentInfo` Set your environment info to prod, dev or staging. Default environment info is prod.
3. `blockedDialog` Set your dialog for the blocked dialog both title and body or you can send it as null as well 

Note: You can check whether Shield SDK is ready or not by using isSDKready function

```
ShieldFraud.isSDKready(async (isReady: boolean) => {
  if (isReady) {
    // Shield is Ready: Do your implementation
  }
}
```

### Get Session ID
Session ID is the unique identifier of a user’s app session and acts as a point of reference when retrieving the device result for that session.


Session ID follows the OS lifecycle management, in-line with industry best practice. This means that a user’s session is active for as long as the device maintains it, unless the user terminates the app or the device runs out of memory and has to kill the app.

If you would like to retrieve device results using the backend API, it is important that you store the Session ID on your system. You will need to call the SHIELD backend API using this Session ID.

```
ShieldFraud.isSDKready(async (isReady: boolean) => {
    if (isReady) {
        const sessionID = await ShieldFraud.getSessionId(); // Fetch session ID using await
        console.log('session id: ', sessionID);
    }
}
```

### Get Device Results
SHIELD provides you actionable device intelligence which you can retrieve from the SDK, via the `Optimized Listener` or `Customized Pull method`. You can also retrieve results via the backend API.

*Warning: Only 1 method of obtaining device results **(Optimized Listener or Customized Pull)** can be in effect at any point in time.*

#### Retrieve device results via Optimized Listener

##### SHIELD recommends the Optimized Listener method to reduce number of API calls. #####

Our SDK will capture an initial device fingerprint upon SDK initialization and return an additional set of device intelligence ONLY if the device fingerprint changes along one session. This ensures a truly optimized end to end protection of your ecosystem.

You can register a callback if you would like to be notified in the event that the device attributes change during the session (for example, a user activates a malicious tool a moment after launching the page).

Add an additional parameter during intialization in order to register a callback. 

For example - ShieldFraud.initShield(config, **callbacks**);
 ```
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
  siteID: 'SHIELD_SITE_ID',
  secretKey: 'SHIELD_SECRET_KEY'
};

ShieldFraud.initShield(config, callbacks);
 ```

#### Retrieve device results via Customized Pull
You can retrieve device results via Customized Pull at specific user checkpoints or activities, such as account registration, login, or checkout. This is to ensure that there is adequate time to generate a device fingerprint.

```
ShieldFraud.isSDKready(async (isReady: boolean) => {
  if (isReady) {
    ShieldFraud.getLatestDeviceResult()
      .then((result: object) => {
        // Handle success with the result object
        console.log('Received latest device result:', result);
      })
      .catch((error: object) => {
        // Handle error with the error object
        console.log('Error retrieving device result:', error);
      });
  }
});
```

It is possible that getLatestDeviceResult returns null if the device result retrieval is unsuccessful. 

### Send Custom Attributes

Use the sendAttributes function to sent event-based attributes such as user_id or activity_id for enhanced analytics. This function accepts two parameters:screenName where the function is triggered, and data to provide any custom fields in key, value pairs.

```
ShieldFraud.isSDKready(async (isReady: boolean) => {
    if (isReady) {
        ShieldFraud.sendAttributes('Screen_Name', { key1: 'value1', key2: 'value2' });
    }
}
```


