import {AppRegistry} from 'react-native'

import App from './App'
import {name as appName} from './app.json'

// Register the root React Native component for the web entrypoint.
AppRegistry.registerComponent(appName, () => App)

// Mount the app into the DOM node provided by public/index.html.
AppRegistry.runApplication(appName, {
  initialProps: {},
  rootTag: document.getElementById('root'),
})
