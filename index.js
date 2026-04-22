/**
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager} from 'sn-plugin-lib';
import {
  BUTTON_DOC_SELECTION_ID,
  BUTTON_DOC_SELECTION_NAME,
  BUTTON_ID,
  BUTTON_NAME,
  SUPPORTED_DATA_TYPES,
} from './src/config';
import {
  sendCurrentDocSelection,
  sendCurrentLassoSelection,
} from './src/actions/uploadLassoSelection';

const iconUri = Image.resolveAssetSource(require('./assets/icon.png')).uri;

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

PluginManager.registerButton(2, ['NOTE', 'DOC'], {
  id: BUTTON_ID,
  name: BUTTON_NAME,
  icon: iconUri,
  editDataTypes: SUPPORTED_DATA_TYPES,
  showType: 0,
});

PluginManager.registerButton(3, ['NOTE', 'DOC'], {
  id: BUTTON_DOC_SELECTION_ID,
  name: BUTTON_DOC_SELECTION_NAME,
  icon: iconUri,
  showType: 0,
});

PluginManager.registerButtonListener({
  onButtonPress(event) {
    if (!event) {
      return;
    }

    const request =
      event.id === BUTTON_ID
        ? sendCurrentLassoSelection
        : event.id === BUTTON_DOC_SELECTION_ID
        ? sendCurrentDocSelection
        : null;

    if (!request) {
      return;
    }

    request().catch(error => {
      console.error('[endpoint-lasso] Request failed', error);
    });
  },
});
