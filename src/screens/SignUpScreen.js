import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { Input, Button, Icon } from 'react-native-elements';
import { Picker } from '@react-native-picker/picker'; // 수정된 부분
import { getUserData, signUpUser, getTeams, getTeamData, updateTeamMemberCount } from '../services/firebaseService'; // 서비스 호출
//import styles from '../style/main.css'; // 스타일 import

function SignUpScreen({ navigation }) { 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [team, setTeam] = useState(''); // 소속팀 상태 추가
  const [ntrp, setNtrp] = useState('');
  const [expYears, setExpYears] = useState(''); // 구력 값을 위한 상태 추가
  const [userId, setUserId] = useState('');
  const [idChecked, setIdChecked] = useState(false);
  const [isIdAvailable, setIsIdAvailable] = useState(false); // ID 사용 가능 상태 추가
  const [teams, setTeams] = useState([]); // 소속팀 목록 상태 추가

  // 각 입력 필드에 대한 ref 생성
  const userIdRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const phoneRef = useRef(null);
  const ntrpRef = useRef(null);
  const expYearsRef = useRef(null);
  const teamRef = useRef(null);
  const nameRef = useRef(null);

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

  const handleIdCheck = async () => {
    if (!userId) {
      Alert.alert('오류', 'ID를 입력해주세요.'); // ID가 비어있을 때 메시지 출력
      setIsIdAvailable(false); // ID 사용 가능 문구 히든 처리
      return; // 종료
    }

    try {
      const userData = await getUserData(userId); // 서비스 호출
      if (userData) {
        Alert.alert('오류', 'ID가 이미 존재합니다.'); // 중복인 경우 메시지 출력
        setIsIdAvailable(false); // ID 사용 가능 문구 히든 처리
      } else {
        Alert.alert('ID 사용 가능');
        setIdChecked(true);
        setIsIdAvailable(true); // ID 사용 가능 상태 설정
      }
    } catch (error) {
      console.error("ID 체크 오류:", error);
      Alert.alert("ID 체크 중 오류가 발생했습니다.");
      setIsIdAvailable(false); // ID 사용 가능 문구 히든 처리
    }
  };

  const handleSignUp = async () => {
    // 필수값 체크
    if (!userId || !password || !confirmPassword || !team) {
      Alert.alert('오류', '아이디, 비밀번호, 소속팀은 필수 항목입니다.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!idChecked) {
      Alert.alert('오류', 'ID 중복 체크를 해주세요.');
      return;
    }
   
    // 팀의 잔여 회원 수 체크
    try {
      const teamData = await getTeamData(team); // 팀 데이터 가져오기
      if (teamData.memberCnt_Free === 0 && teamData.memberCnt_rest === 0) {
        Alert.alert('오류', '해당 팀에 잔여 회원수가 없습니다. 회원 가입하려면 잔여 회원수를 확보해주세요.');
        return;
      }
    } catch (error) {
      console.error("팀 데이터 조회 오류:", error);
      Alert.alert('오류', '팀 데이터 조회 중 오류가 발생했습니다.');
      return;
    }
  
    // 사용자 데이터 객체 생성
    const userData = {
      userPw: password, // 비밀번호
      userEmail: email, // 이메일
      userName: name, // 이름
      userHP: phone, // 연락처
      userTeam: team, // 소속팀
      NTRP: ntrp, // 구력(NTRP)
      expYears: expYears, // 구력 값 저장
      authGroup: "BAS01", // authGroup 값
    };
  
    try {
      await signUpUser(userId, userData); // userId를 문서 이름으로 사용
      Alert.alert('성공', '회원가입이 완료되었습니다.');

      // 팀 잔여 회원 수 차감 서비스 호출
      await updateTeamMemberCount(team);

      navigation.navigate('Login'); // 로그인 화면으로 이동
    } catch (error) {
      Alert.alert('오류', '회원가입 중 오류가 발생했습니다.');
    }
  };



  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Input
            placeholder="아이디"
            value={userId} // New input for ID
            onChangeText={setUserId}
            containerStyle={styles.input}
            leftIcon={<Icon name="user" type="feather" size={20} color="#888" />}
            inputContainerStyle={styles.inputInnerContainer} // 좌측 시작점 동일하게
            onSubmitEditing={() => passwordRef.current.focus()} // 다음 필드로 이동
            ref={userIdRef}
          />
          <Button
            title="ID 중복체크"
            onPress={handleIdCheck}
            buttonStyle={styles.checkButton}
            containerStyle={styles.checkButtonContainer}
          />
        </View>
        
        {/* ID 사용 가능 메시지 조건부 렌더링 */}
        {isIdAvailable && <Text style={styles.checkedText}>ID 사용 가능</Text>} 
        
        {/* 비밀번호 필드 */}
        <Input
          placeholder="비밀번호"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          containerStyle={styles.input}
          leftIcon={<Icon name="lock" type="feather" size={20} color="#888" />}
          rightIcon={
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Icon name={showPassword ? 'eye-off' : 'eye'} type="feather" size={20} color="#888" />
            </TouchableOpacity>
          }
          inputContainerStyle={styles.inputInnerContainer} // 줄 간격 동일하게
          onSubmitEditing={() => confirmPasswordRef.current.focus()} // 다음 필드로 이동
          ref={passwordRef}
        />
        
        <Input
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          containerStyle={styles.input}
          leftIcon={<Icon name="lock" type="feather" size={20} color="#888" />}
          rightIcon={
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} type="feather" size={20} color="#888" />
            </TouchableOpacity>
          }
          inputContainerStyle={styles.inputInnerContainer} // 줄 간격 동일하게
          onSubmitEditing={() => emailRef.current.focus()} // 다음 필드로 이동
          ref={confirmPasswordRef}
        />

         {/* 소속팀 콤보박스 추가 */}
         <View style={styles.inputPickerContainer}>
          <Picker
            selectedValue={team}
            onValueChange={(itemValue) => setTeam(itemValue)}
            style={styles.picker}
            ref={teamRef}
          >
            <Picker.Item label="소속팀 선택" value="" />
            {teams.map((team) => (
              <Picker.Item key={team.id} label={team.teamName} value={team.id} />
            ))}
          </Picker>
        </View>

        {/* 필수 입력 항목 안내 문구 */}
        <Text style={styles.requiredText}>* 아이디, 비밀번호, 소속팀은 필수 항목입니다.</Text>

        <View style={styles.spacing} />

        <Input
          placeholder="이메일"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          containerStyle={styles.input}
          inputContainerStyle={styles.inputInnerContainer} // 테두리 색상 검정으로 변경
          leftIcon={<Icon name="mail" type="feather" size={20} color="#888" />}
          inputStyle={styles.emailInputStyle} // 줄 간격 조정
          onSubmitEditing={() => nameRef.current.focus()} // 다음 필드로 이동
          ref={emailRef}
        />
        
        <Input
          placeholder="이름"
          onChangeText={handleNameChange}
          value={name}
          containerStyle={styles.input}
          inputContainerStyle={styles.inputInnerContainer} // 테두리 색상 검정으로 변경
          leftIcon={<Icon name="user" type="feather" size={20} color="#888" />}
          onSubmitEditing={() => phoneRef.current.focus()} // 다음 필드로 이동
          ref={nameRef}
        />
        
        <Input
          placeholder="연락처"
          value={phone}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          containerStyle={styles.input}
          inputContainerStyle={styles.inputInnerContainer} // 테두리 색상 검정으로 변경
          leftIcon={<Icon name="phone" type="feather" size={20} color="#888" />}
          onSubmitEditing={() => phoneRef.current.focus()} // 다음 필드로 이동
          ref={phoneRef}
        />
        {/* 구력(NTRP) 필드 주석 처리 */}
        {/* <Input
          placeholder="구력(NTRP)"
          value={ntrp}
          onChangeText={handleNtrpChange}
          keyboardType="numeric"
          containerStyle={styles.input}
          inputContainerStyle={styles.inputInnerContainer} // 테두리 색상 검정으로 변경
          leftIcon={<Icon name="award" type="feather" size={20} color="#888" />}
          onSubmitEditing={() => expYearsRef.current.focus()} // 다음 필드로 이동
          ref={ntrpRef}
        /> */}

        {/* 구력 값 입력 필드 추가 */}
        <Input
          placeholder="구력(경험 연수)"
          value={expYears}
          onChangeText={handleExpYearsChange}
          keyboardType="numeric"
          containerStyle={styles.input}
          inputContainerStyle={styles.inputInnerContainer} // 테두리 색상 검정으로 변경
          leftIcon={<Icon name="clock" type="feather" size={20} color="#888" />}
       //   onSubmitEditing={() => teamRef.current.focus()} // 다음 필드로 이동
          ref={expYearsRef}
        />
        
        <Button 
          title="가입하기" 
          onPress={handleSignUp} 
          containerStyle={styles.buttonContainer}
          buttonStyle={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    formContainer: {
      padding: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
      width: '65%', // Ensure the container takes full width
    },
    inputPickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'black', // 테두리 색상 검정으로 변경
      borderRadius: 5,
      paddingLeft: 10,
      marginBottom: 5, // 줄 간격 조정
      height: 50, // 높이 조정하여 글자가 잘리지 않도록
      marginBottom: 15,
      marginLeft: '2.5%', // 좌측 여백 조정
     
      width: '95%', // 연락처 필드와 동일한 가로 길이
    },
    input: {
      marginBottom: 5,
    },
    checkButton: {
      backgroundColor: '#4a90e2',
      paddingHorizontal: 10,
      height: 40,
      marginBottom: 5, // 위치 조정
    },
    checkedText: {
      color: 'green',
      marginBottom: 15,
      marginLeft: '3%', // 좌측 여백 조정
      marginTop: -15, // 위치 조정
    },
    buttonContainer: {
      marginTop: 20,
    },
    button: {
      backgroundColor: '#4a90e2',
      height: 50,
      borderRadius: 25,
    },
    emailInput: {
      flex: 1,
    },
    checkButtonContainer: {
      marginLeft: 10,
      marginBottom: 15,
      width: 'auto', // Adjust button width as needed
    },
    emailInputStyle: {
      lineHeight: 24, // 줄 간격 조정
    },
    inputInnerContainer: {
      borderWidth: 1,
      borderColor: 'black', // 테두리 색상 검정으로 변경
      borderRadius: 5,
      paddingLeft: 10,
      marginBottom: -20, // 줄 간격 조정
      height: 50, // 높이 조정하여 글자가 잘리지 않도록
    },
    inputField: {
      // 배경색 제거
    },
    requiredText: {
      color: 'red',
      fontSize: 12,
      marginBottom: 5, // 문구와 필드 간격 조정
      marginLeft: '3%', // 좌측 여백 조정
    },
    spacing: {
      height: 20, // 여백 추가
    },
    errorText: {
      color: 'red',
      fontSize: 12,
    },
    picker: {
      height: 50,
      width: '100%', // 소속팀 필드의 가로 길이 조정
    },
});

export default SignUpScreen;