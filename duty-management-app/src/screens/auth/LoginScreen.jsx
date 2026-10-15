import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import BrandingFooter from '../../components/BrandingFooter';
import { isValidEmail } from '../../utils/validators';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

export const LoginScreen = () => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPhoneMode, setIsPhoneMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleIdentifierChange = (text) => {
    if (errorMessage) setErrorMessage('');
    if (identifierError) setIdentifierError('');

    if (!text) {
      setIdentifier('');
      setIsPhoneMode(false);
      return;
    }

    // Support pasted or typed numbers with +91 prefix
    let testText = text;
    if (text.startsWith('+91')) {
      const remaining = text.replace(/^\+91[\s-]*/, '');
      if (remaining.length > 0 && /^\d+$/.test(remaining)) {
        testText = remaining;
      }
    }

    // Check if current text is purely numbers
    const isPureDigits = /^\d+$/.test(testText);

    if (isPureDigits) {
      // Pure numbers: cap strictly at 10 digits
      const cleaned = testText.slice(0, 10);
      setIdentifier(cleaned);
      // Auto-change icon to phone icon
      setIsPhoneMode(true);
    } else {
      // Contains letters (like "g") or symbols: treat as email/username without length restriction
      setIdentifier(text);
      // Auto-change icon to email icon
      setIsPhoneMode(false);
    }
  };

  const validate = () => {
    let valid = true;
    setIdentifierError('');
    setPasswordError('');
    setErrorMessage('');

    const cleanInput = identifier.trim();

    if (!cleanInput) {
      setIdentifierError('Email address or mobile number is required');
      valid = false;
    } else {
      const isDigits = /^\d+$/.test(cleanInput);
      if (isDigits) {
        if (cleanInput.length !== 10) {
          setIdentifierError('Mobile number must be exactly 10 digits');
          valid = false;
        }
      } else {
        if (!isValidEmail(cleanInput)) {
          setIdentifierError('Please enter a valid email address');
          valid = false;
        }
      }
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrorMessage('');

    const cleanInput = identifier.trim();
    const result = await login(cleanInput, password);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Branding */}
          <View style={styles.brandContainer}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.appName}>{APP_CONFIG.COMPANY_NAME}</Text>
            <Text style={styles.appSubtitle}>Field Service & Duty Management</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.welcomeTitle}>Sign In</Text>
            <Text style={styles.welcomeSubtitle}>
              Enter your email or phone number to access your account
            </Text>

            <ErrorMessage message={errorMessage} />

            <TextInputField
              label="Email or Mobile Number"
              placeholder="e.g. 9876543210 or name@vairavan.com"
              value={identifier}
              onChangeText={handleIdentifierChange}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={isPhoneMode ? 'call-outline' : identifier ? 'mail-outline' : 'person-outline'}
              maxLength={isPhoneMode ? 10 : undefined}
              error={identifierError}
              required
            />

            <TextInputField
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry
              icon="lock-closed-outline"
              error={passwordError}
              required
            />

            <PrimaryButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />
          </View>

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.footerText}>
              Authorized person only. Contact Admin for account creation.
            </Text>
          </View>

          <BrandingFooter style={styles.brandingFooter} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  loginButton: {
    marginTop: SPACING.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  brandingFooter: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});

export default LoginScreen;
