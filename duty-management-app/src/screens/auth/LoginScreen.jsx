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
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../../utils/pwaUtils';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import BrandingFooter from '../../components/BrandingFooter';
import { isValidEmail } from '../../utils/validators';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

export const LoginScreen = () => {
  const { login } = useAuth();
  const { isStandalone, isIOS, canInstall, promptInstall } = usePWAInstall();

  const [identifier, setIdentifier] = useState('');
  const [showIosGuide, setShowIosGuide] = useState(false);
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

  const handleInstallPress = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    if (canInstall) {
      const res = await promptInstall();
      if (res?.outcome !== 'accepted') {
        setShowIosGuide(true);
      }
    } else {
      setShowIosGuide(true);
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

          {/* PWA Install Banner (Web Only) */}
          {Platform.OS === 'web' && !isStandalone && (
            <TouchableOpacity
              style={styles.pwaInstallCard}
              onPress={handleInstallPress}
              activeOpacity={0.85}
              accessibilityLabel="Install App or Add to Home Screen"
            >
              <View style={styles.pwaInstallIconWrap}>
                <Ionicons
                  name={isIOS ? 'logo-apple' : 'phone-portrait-outline'}
                  size={20}
                  color="#2563EB"
                />
              </View>
              <View style={styles.pwaInstallTextWrap}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.pwaInstallTitle}>
                    {isIOS ? 'Install on iPhone / iPad' : 'Install Vairavan App'}
                  </Text>
                  <View style={styles.pwaPillBadge}>
                    <Text style={styles.pwaPillBadgeText}>PWA APP</Text>
                  </View>
                </View>
                <Text style={styles.pwaInstallSub}>
                  {isIOS
                    ? 'Tap for 3-step easy home screen install guide'
                    : '1-tap access with full-screen experience and offline support'}
                </Text>
              </View>
              <View style={styles.pwaInstallBtn}>
                <Ionicons
                  name={isIOS ? 'help-circle-outline' : canInstall ? 'download-outline' : 'chevron-forward'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.pwaInstallBtnText}>
                  {isIOS ? 'Guide' : canInstall ? 'Install' : 'Info'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.footerText}>
              Authorized person only. Contact Admin for account creation.
            </Text>
          </View>

          {/* iOS & Browser PWA Install Instructions Modal */}
          <Modal
            visible={showIosGuide}
            transparent
            animationType="fade"
            onRequestClose={() => setShowIosGuide(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.modalHeaderIconWrap}>
                      <Ionicons
                        name={isIOS ? 'logo-apple' : 'phone-portrait-outline'}
                        size={22}
                        color="#2563EB"
                      />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>
                        {isIOS ? 'Install on iPhone / iPad' : 'Install Vairavan App'}
                      </Text>
                      <Text style={styles.modalSub}>Add to Home Screen in 3 easy steps</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowIosGuide(false)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Steps Content */}
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {isIOS ? (
                    <>
                      <View style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumberText}>1</Text>
                        </View>
                        <View style={styles.stepTextWrap}>
                          <Text style={styles.stepTitle}>Tap Safari Share Button</Text>
                          <Text style={styles.stepDesc}>
                            In Safari, tap the <Text style={styles.boldText}>Share</Text> button in the toolbar at the bottom of your iPhone screen (or top on iPad).
                          </Text>
                          <View style={styles.stepIconRow}>
                            <View style={styles.stepIconPill}>
                              <Ionicons name="share-outline" size={15} color="#2563EB" />
                              <Text style={styles.stepIconPillText}>Share Icon</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumberText}>2</Text>
                        </View>
                        <View style={styles.stepTextWrap}>
                          <Text style={styles.stepTitle}>Select "Add to Home Screen"</Text>
                          <Text style={styles.stepDesc}>
                            Scroll down the Safari sharing menu and tap <Text style={styles.boldText}>Add to Home Screen</Text>.
                          </Text>
                          <View style={styles.stepIconRow}>
                            <View style={styles.stepIconPill}>
                              <Ionicons name="add-circle-outline" size={15} color="#059669" />
                              <Text style={styles.stepIconPillText}>Add to Home Screen</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumberText}>3</Text>
                        </View>
                        <View style={styles.stepTextWrap}>
                          <Text style={styles.stepTitle}>Tap "Add" in Top-Right</Text>
                          <Text style={styles.stepDesc}>
                            Confirm the app name and tap <Text style={styles.boldText}>Add</Text> in the top-right corner. The Vairavan app icon will now appear on your iPhone home screen!
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumberText}>1</Text>
                        </View>
                        <View style={styles.stepTextWrap}>
                          <Text style={styles.stepTitle}>Open Browser Menu</Text>
                          <Text style={styles.stepDesc}>
                            Tap the three dots (<Text style={styles.boldText}>⋮</Text>) at the top-right corner of Chrome or Edge.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumberText}>2</Text>
                        </View>
                        <View style={styles.stepTextWrap}>
                          <Text style={styles.stepTitle}>Tap "Install app" / "Add to Home screen"</Text>
                          <Text style={styles.stepDesc}>
                            Select <Text style={styles.boldText}>Install app</Text> or <Text style={styles.boldText}>Add to Home screen</Text> from the menu options.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumberText}>3</Text>
                        </View>
                        <View style={styles.stepTextWrap}>
                          <Text style={styles.stepTitle}>Instant Launch</Text>
                          <Text style={styles.stepDesc}>
                            The app opens in a native-like window with full offline support and fast loading!
                          </Text>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Benefit tip */}
                  <View style={styles.modalTipBox}>
                    <Ionicons name="sparkles" size={16} color="#D97706" />
                    <Text style={styles.modalTipText}>
                      Installing as a PWA gives you a full-screen, clean experience with no browser URL bar and offline caching.
                    </Text>
                  </View>
                </ScrollView>

                {/* Modal Footer */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalDoneBtn}
                    onPress={() => setShowIosGuide(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalDoneBtnText}>Got It</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
  pwaInstallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    ...SHADOWS.sm,
  },
  pwaInstallIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  pwaInstallTextWrap: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  pwaInstallTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  pwaPillBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pwaPillBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pwaInstallSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 14,
  },
  pwaInstallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 3,
  },
  pwaInstallBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    maxWidth: 440,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#F8FAFC',
  },
  modalHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
  },
  modalBody: {
    padding: SPACING.lg,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepTextWrap: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: COLORS.text,
  },
  stepIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  stepIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepIconPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  modalTipText: {
    flex: 1,
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#F8FAFC',
  },
  modalDoneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LoginScreen;
