import * as Location from 'expo-location';

/**
 * Format address object from reverse geocode into clean, comma-separated string
 * Example: "Ameyy, Sholinganallur, Chennai, Tamil Nadu, 600119"
 */
export const formatGeocodeAddress = (geo) => {
  if (!geo) return '';

  const components = [
    geo.name,
    geo.street,
    geo.subregion || geo.district,
    geo.city,
    geo.region,
    geo.postalCode,
  ].filter(Boolean);

  // Deduplicate adjacent/repeated terms case-insensitively
  const seen = new Set();
  const deduped = [];
  for (const part of components) {
    const trimmed = String(part).trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      deduped.push(trimmed);
    }
  }

  return deduped.join(', ');
};

/**
 * Perform reverse geocoding on coordinates with caching
 */
const addressCache = new Map();

export const reverseGeocodeCoords = async (latitude, longitude) => {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return '';
  }

  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  if (isNaN(latNum) || isNaN(lngNum)) return '';

  const cacheKey = `${latNum.toFixed(4)},${lngNum.toFixed(4)}`;
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey);
  }

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: latNum,
      longitude: lngNum,
    });

    if (results && results.length > 0) {
      const formatted = formatGeocodeAddress(results[0]);
      if (formatted) {
        addressCache.set(cacheKey, formatted);
        return formatted;
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err.message);
  }

  return '';
};

/**
 * Open coordinate location in device map or Google Maps
 */
export const openMapLocation = async (latitude, longitude, label = 'Duty Location') => {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (isNaN(lat) || isNaN(lng)) return;

  const { Linking, Platform, Alert } = require('react-native');

  const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const appUrl = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label)}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
    default: webUrl,
  });

  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch {
    await Linking.openURL(webUrl).catch(() => {
      Alert.alert('Map Error', 'Unable to open maps application');
    });
  }
};

export default {
  formatGeocodeAddress,
  reverseGeocodeCoords,
  openMapLocation,
};
