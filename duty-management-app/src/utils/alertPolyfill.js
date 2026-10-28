import { Alert, Platform } from 'react-native';

/**
 * Universal Web Alert Polyfill for React Native Web / PWA.
 *
 * In react-native-web, Alert.alert is implemented as an empty function:
 *   class Alert { static alert() {} }
 *
 * This polyfill enables Alert.alert across Web and PWA environments:
 * 1. Simple informational alerts display via window.alert() and automatically
 *    execute the single button's onPress callback (e.g. navigation.goBack() or modal close).
 * 2. Confirmation dialogs with 2+ buttons (e.g. Cancel vs Delete/Discard) display
 *    via window.confirm() and execute either confirm or cancel onPress.
 * 3. Even if window.alert is suppressed or blocked by browser settings,
 *    callbacks are guaranteed to execute via setTimeout, preventing stuck forms or modals.
 */
if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');

    // Case 1: Simple informational notice without buttons
    if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
      try {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(text);
        }
      } catch (_) {}
      return;
    }

    // Case 2: Single button (e.g., OK button with navigation.goBack() or dismiss)
    if (buttons.length === 1) {
      try {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(text);
        }
      } catch (_) {}

      const btn = buttons[0];
      if (btn && typeof btn.onPress === 'function') {
        setTimeout(() => {
          try {
            btn.onPress();
          } catch (err) {
            console.error('[AlertPolyfill] Error in button onPress callback:', err);
          }
        }, 16);
      }
      return;
    }

    // Case 3: 2 or more buttons (e.g., Cancel & Confirm / Delete)
    const cancelBtn =
      buttons.find((b) => b?.style === 'cancel' || b?.text?.toLowerCase() === 'cancel') ||
      buttons[0];
    const confirmBtn =
      buttons.find((b) => b !== cancelBtn && b?.style !== 'cancel') ||
      buttons[1] ||
      buttons[0];

    let confirmed = true;
    try {
      if (typeof window !== 'undefined' && window.confirm) {
        confirmed = window.confirm(text);
      }
    } catch (_) {
      confirmed = true;
    }

    const selectedBtn = confirmed ? confirmBtn : cancelBtn;
    if (selectedBtn && typeof selectedBtn.onPress === 'function') {
      setTimeout(() => {
        try {
          selectedBtn.onPress();
        } catch (err) {
          console.error('[AlertPolyfill] Error in selected button callback:', err);
        }
      }, 16);
    }
  };
}

export default Alert;

