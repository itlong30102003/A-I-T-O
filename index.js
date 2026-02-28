/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './src/app/App';

// Suppress all log notifications in UI
LogBox.ignoreAllLogs(true);

import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
