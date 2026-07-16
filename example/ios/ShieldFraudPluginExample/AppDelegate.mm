#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@interface ReactNativeDelegate : RCTDefaultReactNativeFactoryDelegate
@end

@implementation ReactNativeDelegate

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end

@interface AppDelegate ()

@property (nonatomic, strong) ReactNativeDelegate *reactNativeDelegate;
@property (nonatomic, strong) RCTReactNativeFactory *reactNativeFactory;

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  ReactNativeDelegate *delegate = [ReactNativeDelegate new];
  delegate.dependencyProvider = [RCTAppDependencyProvider new];

  RCTReactNativeFactory *factory = [[RCTReactNativeFactory alloc] initWithDelegate:delegate];
  self.reactNativeDelegate = delegate;
  self.reactNativeFactory = factory;
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];

  [factory startReactNativeWithModuleName:@"ShieldFraudPluginExample"
                                inWindow:self.window
                           launchOptions:launchOptions];

  return YES;
}

@end
