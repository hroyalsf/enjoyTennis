import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StartScreen from './src/screens/StartScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import MainScreen from './src/screens/MainScreen';
import ScheduleRegisterScreen from './src/screens/ScheduleRegisterScreen';
import ScheduleListScreen from './src/screens/ScheduleListScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GameManagerScreen from './src/screens/GameManagerScreen';
import { enableScreens } from 'react-native-screens';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PremiumTeamRegisterScreen from './src/screens/PremiumTeamRegisterScreen';
import ClubManagerScreen from './src/screens/ClubManagerScreen';

// Firebase 초기화를 위해 import
import './src/services/firebaseService';

const Stack = createNativeStackNavigator();

enableScreens();

// 딥링크 지원을 위한 linking 설정
const linking = {
  prefixes: ['enjoytennis://'], // 앱 스킴
  config: {
    screens: {
      Start: 'start',
      Login: 'login',
      SignUp: 'signup',
      Main: 'main',
      ScheduleRegister: 'schedule-register',
      ScheduleList: 'schedule-list',
      Profile: 'profile', // 예: enjoytennis://profile
      GameManager: 'game-manager',
      PremiumTeamRegister: 'premium-team-register',
      ClubManager: 'club-manager',
    },
  },
};

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator initialRouteName="Start">
            <Stack.Screen name="Start" component={StartScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen 
              name="Main" 
              component={MainScreen} 
              options={{ 
                headerShown: false,
                gestureEnabled: false // 뒤로가기 제스처 비활성화
              }} 
            />
            <Stack.Screen 
              name="ScheduleRegister" 
              component={ScheduleRegisterScreen}
              options={{
                title: '일정 등록',
                headerBackTitle: '뒤로'
              }}
            />
            <Stack.Screen 
              name="ScheduleList" 
              component={ScheduleListScreen}
              options={{
                title: '일정 관리',
                headerBackTitle: '뒤로',
              }}
            />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '내 정보', headerBackTitle: '뒤로' }} />
            <Stack.Screen name="GameManager" component={GameManagerScreen} options={{ title: '게임관리' }} />
            <Stack.Screen name="PremiumTeamRegister" component={PremiumTeamRegisterScreen} />
            <Stack.Screen name="ClubManager" component={ClubManagerScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;