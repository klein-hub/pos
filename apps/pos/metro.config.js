// Expo configures Metro for the pnpm monorepo on its own (SDK 52+): no
// watchFolders or nodeModulesPaths here — adding them back breaks resolution.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const CORE_SRC = path.resolve(__dirname, '../../packages/core/src') + path.sep;

/**
 * @digita/core is consumed as TypeScript source and imports its own modules
 * with ESM-style `.js` specifiers (`./types/units.js` for `units.ts`), which
 * TypeScript, Vite and the jest mapper all understand. Metro does not: it
 * looks for a literal units.js and fails. Retry those imports without the
 * extension, for core only, so nothing else's resolution changes.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath.startsWith(CORE_SRC)
  ) {
    return context.resolveRequest(context, moduleName.slice(0, -'.js'.length), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
