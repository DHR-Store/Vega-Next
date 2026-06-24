package com.vega.next

import android.app.Application
import android.content.res.Configuration
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.onesignal.OneSignal
import com.onesignal.debug.LogLevel
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
import expo.modules.updates.UpdatesController

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        ReactNativeHostWrapper(
            this,
            object : DefaultReactNativeHost(this) {
                override fun getPackages(): List<ReactPackage> {
                    val packages = PackageList(this).packages
                    return packages
                }

                override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"
                override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
                override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
                override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
            }
        )

    override val reactHost: ReactHost
        get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }

        ApplicationLifecycleDispatcher.onApplicationCreate(this)

        // ✅ OneSignal Initialization (v5+)
        OneSignal.Debug.logLevel = LogLevel.VERBOSE
        OneSignal.initWithContext(this, "fc34c762-8fbb-45c8-aeb6-b04afbe7c930")

        // ✅ Expo Updates Initialization for OTA
        UpdatesController.initialize(this)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
    }
}