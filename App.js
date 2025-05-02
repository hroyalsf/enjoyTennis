import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StartScreen from './src/screens/StartScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import MainScreen from './src/screens/MainScreen';
import ScheduleRegisterScreen from './src/screens/ScheduleRegisterScreen';
import ScheduleListScreen from './src/screens/ScheduleListScreen';

const Stack = createStackNavigator();

function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;