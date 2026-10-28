import { useWindowDimensions, Platform } from 'react-native';

export const BREAKPOINTS = {
  xs: 480,
  sm: 768,
  md: 1024,
  lg: 1280,
};

/**
 * Universal Responsive Layout Hook for Mobile, Tablet, Laptop & Desktop
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isSmallMobile = width < BREAKPOINTS.xs;
  const isMobile = width < BREAKPOINTS.sm;
  const isTablet = width >= BREAKPOINTS.sm && width < BREAKPOINTS.md;
  const isDesktop = width >= BREAKPOINTS.md;
  const isWide = width >= BREAKPOINTS.lg;
  const isLandscape = width > height;

  // Maximum width for reading/form/dashboard content to prevent awkward stretching on ultra-wide screens
  const maxContentWidth = isWide ? 1280 : isDesktop ? 1024 : isTablet ? 768 : '100%';
  const maxFormWidth = 760;

  // Horizontal gutter spacing
  const gutter = isWide ? 32 : isDesktop ? 24 : isTablet ? 20 : 16;

  /**
   * Helper to determine optimal columns for grids (KPI cards, duty cards, etc.)
   */
  const getColumns = (minItemWidth = 260) => {
    if (isMobile) return 1;
    const available = Math.min(width - gutter * 2, typeof maxContentWidth === 'number' ? maxContentWidth : width);
    const cols = Math.floor(available / minItemWidth);
    return Math.max(1, Math.min(cols, 4));
  };

  return {
    width,
    height,
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isLandscape,
    isWeb: Platform.OS === 'web',
    maxContentWidth,
    maxFormWidth,
    gutter,
    getColumns,
  };
};

export default useResponsive;

