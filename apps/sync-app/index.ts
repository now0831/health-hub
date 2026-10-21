import { registerRootComponent } from 'expo';

// 백그라운드 작업은 앱 시작 전에 정의돼 있어야 한다
import './src/background';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
