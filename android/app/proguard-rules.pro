# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ==============================================
# REACT NATIVE & COMMON
# ==============================================
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ==============================================
# ONESIGNAL (CRITICAL FOR PUSH NOTIFICATIONS)
# ==============================================
-keep class com.onesignal.** { *; }
-keep class com.onesignal.shortcutbadger.** { *; }
-keep class com.onesignal.notifications.** { *; }

# Keep classes that use reflection
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keep class com.onesignal.ActivityLifecycleListenerCompat** { *; }

# ==============================================
# FIREBASE (FOR CLOUD MESSAGING)
# ==============================================
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firebase Messaging
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }

# ==============================================
# NOTIFEE (IF YOU USE IT FOR FOREGROUND NOTIFICATIONS)
# ==============================================
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**
-keep class app.notifee.** { *; }

# ==============================================
# EXPO MODULES
# ==============================================
-keep class expo.modules.** { *; }
-keep class org.unimodules.** { *; }

# ==============================================
# OKHTTP (NETWORKING)
# ==============================================
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ==============================================
# GENERAL ANDROID RULES
# ==============================================
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Exceptions

# Keep parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep custom views
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
    public void set*(...);
    public void on*(...);
}

# Keep R classes (resources)
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}