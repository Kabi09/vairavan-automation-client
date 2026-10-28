import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

const PULL_THRESHOLD = 65; // pixels required to trigger refresh

/**
 * WebPullToRefresh
 * Adds pull-down and pull-up touch refresh gestures for Web & PWA,
 * plus a quick-refresh shortcut for desktop/mouse users.
 * On native mobile, seamlessly passes through children.
 */
export const WebPullToRefresh = ({
  children,
  onRefresh,
  refreshing = false,
  style,
}) => {
  if (Platform.OS !== 'web') {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  const [pullDownDistance, setPullDownDistance] = useState(0);
  const [pullUpDistance, setPullUpDistance] = useState(0);
  const [isRefreshingInternal, setIsRefreshingInternal] = useState(false);

  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef(null);

  const isRefreshing = refreshing || isRefreshingInternal;

  const handleRefresh = useCallback(async () => {
    setIsRefreshingInternal(true);
    setPullDownDistance(0);
    setPullUpDistance(0);
    try {
      if (typeof onRefresh === 'function') {
        await onRefresh();
      } else if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (_) {
    } finally {
      setIsRefreshingInternal(false);
    }
  }, [onRefresh]);

  // Touch handlers for Web/PWA
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getScrollTop = () => {
      return (
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    };

    const isAtBottom = () => {
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      return windowHeight + getScrollTop() >= docHeight - 15;
    };

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY;
        isDraggingRef.current = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || !e.touches || e.touches.length !== 1 || isRefreshing) {
        return;
      }
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;
      const scrollTop = getScrollTop();

      // Pull DOWN at top of page
      if (scrollTop <= 5 && deltaY > 0) {
        // Damped pull distance
        const distance = Math.min(100, Math.max(0, deltaY * 0.45));
        setPullDownDistance(distance);
        setPullUpDistance(0);
      }
      // Pull UP at bottom of page
      else if (isAtBottom() && deltaY < 0) {
        const distance = Math.min(100, Math.max(0, -deltaY * 0.45));
        setPullUpDistance(distance);
        setPullDownDistance(0);
      } else {
        if (pullDownDistance > 0) setPullDownDistance(0);
        if (pullUpDistance > 0) setPullUpDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      if (pullDownDistance >= PULL_THRESHOLD || pullUpDistance >= PULL_THRESHOLD) {
        handleRefresh();
      } else {
        setPullDownDistance(0);
        setPullUpDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, pullDownDistance, pullUpDistance, handleRefresh]);

  const showTopIndicator = pullDownDistance > 10 || (isRefreshing && pullDownDistance > 0);
  const showBottomIndicator = pullUpDistance > 10 || (isRefreshing && pullUpDistance > 0);

  return (
    <View ref={containerRef} style={[styles.container, style]}>
      {/* Top Pull Down Refresh Banner */}
      {showTopIndicator && (
        <View style={styles.topIndicatorWrap}>
          <View style={styles.indicatorPill}>
            {isRefreshing ? (
              <>
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.indicatorText}>Refreshing data...</Text>
              </>
            ) : pullDownDistance >= PULL_THRESHOLD ? (
              <>
                <Ionicons name="refresh-circle" size={20} color="#059669" style={{ marginRight: 6 }} />
                <Text style={[styles.indicatorText, { color: '#059669', fontWeight: '700' }]}>
                  Release to refresh
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="arrow-down" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.indicatorText}>Pull down to refresh</Text>
              </>
            )}
          </View>
        </View>
      )}

      {children}

      {/* Bottom Pull Up Refresh Banner */}
      {showBottomIndicator && (
        <View style={styles.bottomIndicatorWrap}>
          <View style={styles.indicatorPill}>
            {isRefreshing ? (
              <>
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.indicatorText}>Refreshing data...</Text>
              </>
            ) : pullUpDistance >= PULL_THRESHOLD ? (
              <>
                <Ionicons name="refresh-circle" size={20} color="#059669" style={{ marginRight: 6 }} />
                <Text style={[styles.indicatorText, { color: '#059669', fontWeight: '700' }]}>
                  Release to refresh
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="arrow-up" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.indicatorText}>Pull up to refresh</Text>
              </>
            )}
          </View>
        </View>
      )}

      {/* Desktop Quick-Refresh Floating Pill Button */}
      {Boolean(onRefresh) && (
        <TouchableOpacity
          style={styles.floatingRefreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.8}
          accessibilityLabel="Refresh current page"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sync" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.floatingRefreshText}>
            {isRefreshing ? 'Updating...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  topIndicatorWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  bottomIndicatorWrap: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  indicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  floatingRefreshBtn: {
    position: 'absolute',
    bottom: 76,
    right: 16,
    zIndex: 990,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E40AF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingRefreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default WebPullToRefresh;

