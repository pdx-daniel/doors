const path = require('node:path')
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config')
const {withNativewind} = require('nativewind/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = mergeConfig(getDefaultConfig(projectRoot), {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    disableHierarchicalLookup: true,
    unstable_conditionNames: ['browser', 'require', 'react-native'],
  },
})

module.exports = withNativewind(config)
