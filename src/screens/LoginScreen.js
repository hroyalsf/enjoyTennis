import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Input, Button, Icon } from 'react-native-elements';
import { signIn } from '../services/firebaseService';

function LoginScreen({ navigation }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleIdChange = (text) => {
    const filteredText = text.replace(/[^a-zA-Z0-9]/g, '');
    setId(filteredText);
  };

  const handleLogin = async () => {
    if (!id) {
      Alert.alert("로그인 실패", "아이디를 입력해주세요.");
      return;
    }
    if (!password) {
      Alert.alert("로그인 실패", "비밀번호를 입력해주세요.");
      return;
    }

    try {
      const result = await signIn(id, password);
      if (result && result.user) {
        navigation.replace('Main', { userId: id });
      }
    } catch (error) {
      console.error("로그인 오류:", error);
      if (error.message === 'user-not-found') {
        Alert.alert("로그인 실패", "존재하지 않는 아이디입니다.");
      } else if (error.message === 'wrong-password') {
        Alert.alert("로그인 실패", "비밀번호가 올바르지 않습니다.");
      } else {
        Alert.alert("로그인 실패", "로그인 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Input
          placeholder="아이디"
          value={id}
          onChangeText={handleIdChange}
          autoCapitalize="none"
          containerStyle={styles.input}
          leftIcon={<Icon name="user" type="feather" size={20} color="#888" />}
        />
        <Input
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          containerStyle={styles.input}
          leftIcon={<Icon name="lock" type="feather" size={20} color="#888" />}
        />
        <Button 
          title="로그인" 
          onPress={handleLogin} 
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
    </View>
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
});

export default LoginScreen;