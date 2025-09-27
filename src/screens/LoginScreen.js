import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Input, Button, Icon } from 'react-native-elements';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signIn } from '../services/firebaseService';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveId, setSaveId] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  // 앱 시작 시 저장된 이메일/자동로그인 불러오기 및 자동로그인 시도
  useEffect(() => {
    const loadSavedId = async () => {
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const autoLoginFlag = await AsyncStorage.getItem('autoLogin');
      if (savedEmail) {
        setEmail(savedEmail);
        setSaveId(true);
      }
      if (autoLoginFlag === 'true' && savedEmail) {
        setAutoLogin(true);
        // 자동로그인 시도 (비밀번호는 저장하지 않으므로, 자동로그인 시도는 이메일만으로 불가)
        // 실제 자동로그인을 하려면 refresh token 등 별도 인증이 필요하지만,
        // 여기서는 UX적으로만 처리: 이메일이 있으면 자동로그인 시도(비밀번호 입력 필요 없음)
        // 만약 비밀번호 저장을 원한다면(권장X), 아래 주석 해제
        // const savedPassword = await AsyncStorage.getItem('savedPassword');
        // if (savedPassword) setPassword(savedPassword);
        // if (savedEmail && savedPassword) handleLogin(savedEmail, savedPassword, true);
      }
    };
    loadSavedId();
  }, []);

  // 앱 시작 시 Firebase Auth 세션 체크로 자동로그인
  useEffect(() => {
    const checkAuthSession = async () => {
      const autoLoginFlag = await AsyncStorage.getItem('autoLogin');
      if (autoLoginFlag === 'true') {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            navigation.replace('Main', { userId: user.uid });
          }
        });
        return () => unsubscribe();
      }
    };
    checkAuthSession();
  }, []);

  const handleLogin = async (overrideEmail, overridePassword, silent) => {
    const loginEmail = overrideEmail || email;
    const loginPassword = overridePassword || password;
    if (!loginEmail) {
      if (!silent) Alert.alert("로그인 실패", "이메일을 입력해주세요.");
      return;
    }
    if (!loginPassword) {
      if (!silent) Alert.alert("로그인 실패", "비밀번호를 입력해주세요.");
      return;
    }
    try {
      const result = await signIn(loginEmail, loginPassword);
      if (result && result.user) {
        // ID 저장 체크 시 이메일 저장, 아니면 삭제
        if (saveId) {
          await AsyncStorage.setItem('savedEmail', loginEmail);
        } else {
          await AsyncStorage.removeItem('savedEmail');
        }
        // 자동로그인 체크 시 플래그 저장, 아니면 삭제
        if (autoLogin) {
          await AsyncStorage.setItem('autoLogin', 'true');
        } else {
          await AsyncStorage.removeItem('autoLogin');
        }
        // 비밀번호 저장은 보안상 권장하지 않으므로 저장하지 않음
        navigation.replace('Main', { userId: result.user.uid, userData: result.userData });
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        if (!silent) Alert.alert("로그인 실패", "존재하지 않는 이메일입니다.");
      } else if (error.code === 'auth/wrong-password') {
        if (!silent) Alert.alert("로그인 실패", "비밀번호가 올바르지 않습니다.");
      } else if (error.code === 'auth/invalid-email') {
        if (!silent) Alert.alert("로그인 실패", "이메일 형식이 올바르지 않습니다.");
      } else {
        if (!silent) Alert.alert("로그인 실패", "로그인 중 오류가 발생했습니다.");
      }
    }
  };

  // 버전 정보 가져오기
  let versionName = '1.0.0';

  if (Constants.appOwnership === 'expo') {
    // Expo Go 환경 (manifest가 null일 수 있으니 안전하게 체크)
    versionName =
      (Constants.manifest && Constants.manifest.version) ||
      (Constants.expoConfig && Constants.expoConfig.version) ||
      '1.0.0';
  } else {
    // EAS 빌드/앱스토어/스탠드얼론 앱
    versionName = Application.nativeApplicationVersion || '1.0.0';
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'android' ? 30 : 0}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: 80, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.formContainer}>
            <Input
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              containerStyle={styles.input}
              leftIcon={<Icon name="mail" type="feather" size={20} color="#888" />}
            />
            <Input
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              containerStyle={styles.input}
              leftIcon={<Icon name="lock" type="feather" size={20} color="#888" />}
            />

            {/* ID 저장 체크박스 */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSaveId(!saveId)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, saveId && styles.checkboxChecked]}>
                {saveId && <Icon name="check" type="feather" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>ID 저장</Text>
            </TouchableOpacity>
            {/* 자동로그인 체크박스 */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAutoLogin(!autoLogin)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, autoLogin && styles.checkboxChecked]}>
                {autoLogin && <Icon name="check" type="feather" size={16} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>자동로그인</Text>
            </TouchableOpacity>

            <Button 
              title="로그인" 
              onPress={() => handleLogin(null, null, false)} 
              containerStyle={styles.buttonContainer}
              buttonStyle={styles.button}
            />
            <Button
              title="회원가입"
              onPress={() => navigation.navigate('SignUp')}
              type="outline"
              containerStyle={styles.buttonContainer}
              buttonStyle={styles.outlineButton}
              titleStyle={styles.outlineButtonTitle}
            />
          </View>
          {/* 버튼 아래에 버전 정보 배치, 충분한 여백 */}
          <View style={styles.versionContainerFixed}>
            <Text style={styles.versionText}>v{versionName}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  formContainer: {
    padding: 20,
  },
  input: {
    marginBottom: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#4a90e2',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#444',
  },
  buttonContainer: {
    marginTop: 10,
  },
  button: {
    backgroundColor: '#4a90e2',
    height: 50,
    borderRadius: 25,
  },
  outlineButton: {
    borderColor: '#4a90e2',
    height: 50,
    borderRadius: 25,
  },
  outlineButtonTitle: {
    color: '#4a90e2',
  },
  versionContainerFixed: {
    marginTop: 8,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 20,
  },
  versionText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default LoginScreen;