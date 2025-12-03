const { getDefaultConfig } = require('expo/metro-config');

/**
 * Enable package exports resolution so Metro can resolve subpath exports
 * like "firebase/auth/react-native" in Firebase v10+.
 */
const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.unstable_enablePackageExports = true;

module.exports = config;


