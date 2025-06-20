import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ScrollView, KeyboardAvoidingView, Platform, TextInput, BackHandler } from 'react-native';
import { Input, Button, Icon } from 'react-native-elements';
import { Picker } from '@react-native-picker/picker'; // 수정된 부분
import { getUserData, signUpUser, getTeams, getTeamData, updateTeamMemberCount } from '../services/firebaseService'; // 서비스 호출
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
//import styles from '../style/main.css'; // 스타일 import

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 16,
    height: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#222',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  inputAndroid: {
    fontSize: 16,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#222',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
  },
  iconContainer: {
    top: 16,
    right: 12,
  },
  placeholder: {
    color: '#aaa',
  },
};

function SignUpScreen({ navigation, route }) { 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [team, setTeam] = useState('');
  const [ntrp, setNtrp] = useState('');
  const [expYears, setExpYears] = useState('');
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [gender, setGender] = useState('');
  const [pendingPremium, setPendingPremium] = useState(false);
  const [alertedPremium, setAlertedPremium] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const phoneRef = useRef(null);
  const ntrpRef = useRef(null);
  const expYearsRef = useRef(null);
  const teamRef = useRef(null);
  const nameRef = useRef(null);

  const isPremium = route?.params?.isPremium;

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsData = await getTeams();
        setTeams(teamsData);
      } catch (error) {
        console.error("소속팀 조회 오류:", error);
      }
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    const onBackPress = () => true; // true를 반환하면 뒤로가기 무시
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  useEffect(() => {
    if (isPremium) {
      AsyncStorage.setItem('pendingPremiumSignUp', 'true');
    }
  }, [isPremium]);

  useEffect(() => {
    const checkPremiumPending = async () => {
      const pending = await AsyncStorage.getItem('pendingPremiumSignUp');
      if (pending === 'true' && !isPremium && !alertedPremium) {
        setAlertedPremium(true);
        Alert.alert('프리미엄 회원가입 안내', '프리미엄 소속팀 등록이 완료되어 프리미엄 회원가입으로 진행됩니다.');
      } else if (pending === 'true' && !isPremium && alertedPremium) {
        // alert 후에는 pendingPremiumSignUp을 삭제하고 일반 회원가입으로 전환
        await AsyncStorage.removeItem('pendingPremiumSignUp');
        setPendingPremium(false);
      }
    };
    checkPremiumPending();
  }, [isPremium, alertedPremium]);

  useEffect(() => {
    AsyncStorage.getItem('pendingPremiumSignUp').then(val => {
      setPendingPremium(val === 'true');
    });
  }, []);

  const handlePhoneChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setPhone(numericValue);
  };

  const handleNtrpChange = (text) => {
    const numericValue = text.replace(/[^0-9.]/g, '');
    setNtrp(numericValue);
  };

  const handleExpYearsChange = (text) => {
    const numericValue = text.replace(/[^0-9.]/g, ''); // 소수점 포함 숫자만 허용
    setExpYears(numericValue);
  };

  const handleEmailChange = (text) => {
    const filteredText = text.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
    setEmail(filteredText);
  };

  const handleNameChange = (text) => {
    setName(text);
  };

  const handlePasswordChange = (text) => {
    const filteredText = text.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
    setPassword(filteredText);
  };

  const handleConfirmPasswordChange = (text) => {
    const filteredText = text.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '');
    setConfirmPassword(filteredText);
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !team || !gender) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 팀의 잔여 회원 수 체크 (memberCnt_rest만)
    try {
      const teamData = await getTeamData(team); // 팀 데이터 가져오기
      if (teamData.memberCnt_rest === 0) {
        Alert.alert(
          '오류',
          '해당 클럽에 잔여 회원수가 없습니다.\n클럽 리더(회장)에게 잔여 회원수 추가를 요청해주세요.'
        );
        return;
      }
    } catch (error) {
      console.error("팀 데이터 조회 오류:", error);
      Alert.alert('오류', '팀 데이터 조회 중 오류가 발생했습니다.');
      return;
    }
  
    // 실제 가입 직전에 pendingPremiumSignUp 값을 직접 체크
    let premiumFlag = isPremium;
    try {
      const pending = await AsyncStorage.getItem('pendingPremiumSignUp');
      if (pending === 'true') premiumFlag = true;
    } catch (e) {}

    const userData = {
      userName: name,
      userGender: gender,
      userHP: phone,
      userTeam: team,
      NTRP: ntrp,
      expYears: expYears,
      authGroup: premiumFlag ? "ADM01" : "BAS01",
      userStat: premiumFlag ? 200 : 100,
    };
  
    try {
      await signUpUser(email, password, userData);
      const exp = parseFloat(expYears) || 0;
      const abilityValue = Math.round((exp * 100) * 10) / 10;
      const abilityInt = Math.round(abilityValue);
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { ability: increment(abilityInt) });
      }
      // 회원가입 성공 시에는 무조건 pendingPremiumSignUp 삭제
      await AsyncStorage.removeItem('pendingPremiumSignUp');
      // userStat 값에 따라 안내 문구 분기
      if ((userData.userStat || 0) === 100) {
        Alert.alert('안내', '회원가입 요청이 완료되었습니다.\n클럽 리더 승인 후 이용하실 수 있습니다.');
      } else {
        Alert.alert('성공', '회원가입이 완료되었습니다.');
      }
      await updateTeamMemberCount(team);
      navigation.navigate('Login');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('오류', '이미 사용 중인 이메일입니다.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('오류', '이메일 형식이 올바르지 않습니다.');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('오류', '비밀번호는 6자 이상이어야 합니다.');
      } else {
        Alert.alert('오류', '회원가입 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f7f7f7' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === 'ios' ? 60 : 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>회원가입</Text>

        {/* 1. 이메일 */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            ref={emailRef}
          />
        </View>

        {/* 2. 비밀번호 */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            ref={passwordRef}
            autoCorrect={false}
            autoCapitalize="none"
            textContentType="password"
          />
        </View>

        {/* 3. 비밀번호 확인 */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="비밀번호 확인"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            ref={confirmPasswordRef}
            autoCorrect={false}
            autoCapitalize="none"
            textContentType="password"
          />
        </View>

        {/* 4. 이름 */}
        <View style={styles.inputContainer}>
          <Ionicons name="person" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="이름"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={handleNameChange}
            ref={nameRef}
          />
        </View>

        {/* 4-1. 성별 */}
        <View style={styles.inputPickerContainer}>
          <RNPickerSelect
            onValueChange={(value) => setGender(value)}
            items={[
              { label: '남', value: 'male' },
              { label: '여', value: 'female' }
            ]}
            value={gender}
            placeholder={{ label: '성별 선택', value: '' }}
            style={pickerSelectStyles}
            useNativeAndroidPickerStyle={false}
            Icon={() => <Ionicons name="chevron-down" size={20} color="#aaa" />}
          />
        </View>

        {/* 5. 연락처 */}
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="연락처(숫자만)"
            placeholderTextColor="#aaa"
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            ref={phoneRef}
            maxLength={11}
          />
        </View>

        {/* 6. 구력(년수) */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="timer" size={20} color="#aaa" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="구력(년수)"
            placeholderTextColor="#aaa"
            value={expYears}
            onChangeText={handleExpYearsChange}
            keyboardType="decimal-pad"
            ref={expYearsRef}
          />
        </View>

        {/* 7. 소속팀 선택 */}
        <View style={styles.inputPickerContainer}>
          <RNPickerSelect
            onValueChange={(value) => setTeam(value)}
            items={teams.map(team => ({
              label: `${team.teamName} (${team.id})`,
              value: team.id
            }))}
            value={team}
            placeholder={{ label: '클럽 선택', value: '' }}
            style={pickerSelectStyles}
            useNativeAndroidPickerStyle={false}
            Icon={() => <Ionicons name="chevron-down" size={20} color="#aaa" />}
          />
        </View>

        {/* 에러 메시지: 소속팀 아래, 회원가입 버튼 위 */}
        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSignUp}>
          <Text style={styles.buttonText}>회원가입</Text>
        </TouchableOpacity>

        {!isPremium && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>이미 계정이 있으신가요? 로그인</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f7f7',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 32,
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#222',
  },
  button: {
    backgroundColor: '#4f8cff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    shadowColor: '#4f8cff',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#4f8cff',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  error: {
    color: '#ff4d4f',
    marginBottom: 8,
    textAlign: 'center',
  },
  inputPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  picker: {
    height: 50,
    width: '100%', // 소속팀 필드의 가로 길이 조정
  },
  idCheckButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  idCheckButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pickerSelectStyles: {
    inputIOS: {
      fontSize: 16,
      height: 48,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      color: '#222',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#eee',
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 2,
    },
    inputAndroid: {
      fontSize: 16,
      height: 48,
      paddingHorizontal: 12,
      borderRadius: 12,
      color: '#222',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#eee',
      elevation: 2,
    },
    iconContainer: {
      top: 16,
      right: 12,
    },
    placeholder: {
      color: '#aaa',
    },
  },
});

export default SignUpScreen;