module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'babel-plugin-module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
        },
      },
    ],
    'react-native-worklets/plugin',
  ],
  env: {
    web: {
      plugins: ['react-native-web'],
    },
  },
}
