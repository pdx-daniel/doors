const path = require('node:path')

module.exports = {
  project: {
    ios: {},
    android: {},
  },
  watchFolders: [path.resolve(__dirname, '../..')],
}
