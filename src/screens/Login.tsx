/**
 * Login.tsx — Email/password login + sign-up + reset.
 * Shows profile avatar with photo picker after login (via ProfileAvatar).
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  DeviceEventEmitter,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {userSession} from '../lib/services/login';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';
import Icon from 'react-native-vector-icons/Feather';
import ProfileAvatar from './Profileavatar'; // ← shows after sign-in

type LoginNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Login'
>;
type Mode = 'signin' | 'signup' | 'reset';

const EMAIL_REGEX = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred. Please try again.';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // After login we briefly show the profile step before navigating
  const [loggedInUser, setLoggedInUser] = useState<{
    name: string;
    email: string;
  } | null>(null);

  // State for editing the name during the profile step
  const [profileName, setProfileName] = useState('');

  const navigation = useNavigation<LoginNavigationProp>();

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const trimEmail = email.trim();
    if (!trimEmail) {
      setError('Please enter your email address.');
      return false;
    }
    if (!EMAIL_REGEX.test(trimEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (mode === 'reset') {
      setError(null);
      return true;
    }
    if (!password) {
      setError('Please enter your password.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    setError(null);
    return true;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'reset') {
        await userSession.sendPasswordReset(email.trim());
        setSuccessMsg('Password reset email sent! Check your inbox.');
        return;
      }

      const user =
        mode === 'signup'
          ? await userSession.signUp(email.trim(), password)
          : await userSession.signInWithEmail(email.trim(), password);

      // Show the profile photo step briefly before entering the app
      setLoggedInUser({name: user.name, email: user.email});
      setProfileName(user.name);
    } catch (err) {
      const msg = extractMessage(err);
      setError(msg);
      Alert.alert(mode === 'signup' ? 'Sign Up Failed' : 'Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const goToApp = async () => {
    if (!loggedInUser) return;

    // Check if the user modified their name
    const finalName = profileName.trim() || loggedInUser.name;

    if (finalName !== loggedInUser.name) {
      setLoading(true);
      await userSession.updateName(finalName);
      setLoading(false);
    }

    const updatedUser = userSession.getCurrentUser() || {
      ...loggedInUser,
      name: finalName,
    };
    DeviceEventEmitter.emit('userLoggedIn', updatedUser);
    navigation.reset({index: 0, routes: [{name: 'MainStack'}]});
  };

  // ── Mode switch ────────────────────────────────────────────────────────────

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  // ── Post-login profile step ────────────────────────────────────────────────

  if (loggedInUser) {
    return (
      <View style={styles.profileStep}>
        <Text style={styles.profileStepTitle}>You're in! 🎉</Text>
        <Text style={styles.profileStepSub}>
          Set your name and profile photo or continue to the app.
        </Text>

        {/* Avatar with photo picker */}
        <ProfileAvatar size={110} editable={true} />

        {/* Editable Name Input */}
        <TextInput
          style={styles.nameInput}
          value={profileName}
          onChangeText={setProfileName}
          placeholder="Enter your name"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
        />
        <Text style={styles.profileEmail}>{loggedInUser.email}</Text>

        <TouchableOpacity
          style={[styles.primaryBtn, {opacity: loading ? 0.7 : 1}]}
          activeOpacity={0.85}
          disabled={loading}
          onPress={goToApp}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue to App</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.profileSkip}>
          You can change your photo and name anytime from your profile settings.
        </Text>
      </View>
    );
  }

  // ── Auth form ──────────────────────────────────────────────────────────────

  const titles: Record<Mode, string> = {
    signin: 'Welcome Back',
    signup: 'Create Account',
    reset: 'Reset Password',
  };

  const subtitles: Record<Mode, string> = {
    signin: 'Sign in to sync your watchlist and history.',
    signup: 'Create an account so your data is restored after reinstall.',
    reset: 'Enter your email to receive a password reset link.',
  };

  const buttonLabels: Record<Mode, string> = {
    signin: 'Sign In',
    signup: 'Create Account',
    reset: 'Send Reset Email',
  };

  return (
    <KeyboardAvoidingView
      style={{flex: 1, backgroundColor: '#000'}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>V</Text>
        </View>

        <Text style={styles.title}>{titles[mode]}</Text>
        <Text style={styles.subtitle}>{subtitles[mode]}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMsg ? (
          <Text style={styles.successText}>{successMsg}</Text>
        ) : null}

        {/* Email */}
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={t => {
            setEmail(t);
            setError(null);
          }}
          editable={!loading}
        />

        {/* Password */}
        {mode !== 'reset' && (
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={t => {
                setPassword(t);
                setError(null);
              }}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(p => !p)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              style={styles.eyeBtn}>
              <Icon
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#9ca3af"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Confirm password */}
        {mode === 'signup' && (
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={t => {
                setConfirmPassword(t);
                setError(null);
              }}
              editable={!loading}
            />
          </View>
        )}

        {/* Forgot password */}
        {mode === 'signin' && (
          <TouchableOpacity
            onPress={() => switchMode('reset')}
            style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Action button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
          style={[styles.primaryBtn, {opacity: loading ? 0.7 : 1}]}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryBtnText}>{buttonLabels[mode]}</Text>
          )}
        </TouchableOpacity>

        {/* Mode switchers */}
        <View style={styles.switchRow}>
          {mode === 'signin' && (
            <>
              <Text style={styles.switchLabel}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => switchMode('signup')}>
                <Text style={styles.switchLink}>Sign Up</Text>
              </TouchableOpacity>
            </>
          )}
          {mode === 'signup' && (
            <>
              <Text style={styles.switchLabel}>Already have an account? </Text>
              <TouchableOpacity onPress={() => switchMode('signin')}>
                <Text style={styles.switchLink}>Sign In</Text>
              </TouchableOpacity>
            </>
          )}
          {mode === 'reset' && (
            <TouchableOpacity onPress={() => switchMode('signin')}>
              <Text style={styles.switchLink}>← Back to Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.syncNote}>
          Your watchlist and history are automatically synced and restored on
          reinstall.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Auth form ──
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  logoText: {color: '#fff', fontSize: 40, fontWeight: 'bold'},
  title: {color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8},
  subtitle: {
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  successText: {
    color: '#22c55e',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
    fontSize: 15,
  },
  passwordRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  eyeBtn: {paddingHorizontal: 14},
  forgotBtn: {alignSelf: 'flex-end', marginBottom: 20},
  forgotText: {color: '#9ca3af', fontSize: 13},
  primaryBtn: {
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {color: '#000', fontWeight: 'bold', fontSize: 16},
  switchRow: {flexDirection: 'row', marginTop: 20, alignItems: 'center'},
  switchLabel: {color: '#9ca3af', fontSize: 14},
  switchLink: {color: '#fff', fontSize: 14, fontWeight: '600'},
  syncNote: {
    color: '#4b5563',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 16,
    paddingHorizontal: 16,
  },

  // ── Profile step ──
  profileStep: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  profileStepTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileStepSub: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  nameInput: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileEmail: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 32,
  },
  profileSkip: {
    color: '#4b5563',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
    paddingHorizontal: 24,
  },
});
