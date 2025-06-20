import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebaseService';

const PremiumTeamRegisterScreen = ({ navigation }) => {
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDate, setTeamDate] = useState('');
  const [teamCourt, setTeamCourt] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [checkMsg, setCheckMsg] = useState('');

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: '클럽 신규 생성' });
  }, [navigation]);

  const handleCheckDuplicate = async () => {
    setCheckMsg('');
    if (!teamCode) {
      setIsChecked(false);
      setCheckMsg('소속팀코드를 입력해주세요.');
      return;
    }
    if (!/^[A-Za-z]+$/.test(teamCode)) {
      Alert.alert('오류', '소속팀코드는 영문만 입력 가능합니다.');
      setIsChecked(false);
      setCheckMsg('');
      return;
    }
    const ref = doc(db, 'teams', teamCode);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      Alert.alert('중복', '이미 사용 중인 소속팀코드입니다.');
      setIsChecked(false);
      setCheckMsg('이미 사용 중인 소속팀코드입니다.');
    } else {
      Alert.alert('확인', '사용 가능한 소속팀코드입니다.');
      setIsChecked(true);
      setCheckMsg('중복체크 성공');
    }
  };

  const handleRegister = async () => {
    if (!isChecked) {
      Alert.alert('오류', '소속팀코드 중복체크를 해주세요.');
      return;
    }
    if (!teamCode || !teamName || !teamDate || !teamCourt) {
      Alert.alert('오류', '모든 항목을 입력해주세요.');
      return;
    }
    try {
      await setDoc(doc(db, 'teams', teamCode), {
        teamName,
        teamDate,
        teamCourt,
        memberCnt: 0,
        memberCnt_rest: 10,
      });
      Alert.alert('성공', '소속팀이 등록되었습니다.', [
        {
          text: '확인',
          onPress: () => navigation.reset({
            index: 0,
            routes: [
              { name: 'SignUp', params: { team: teamCode, isPremium: true } }
            ]
          }),
        },
      ]);
    } catch (e) {
      Alert.alert('오류', '소속팀 등록에 실패했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>클럽 등록</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="클럽코드(영문)"
          value={teamCode}
          onChangeText={text => {
            setTeamCode(text.replace(/[^A-Za-z]/g, ''));
            setIsChecked(false);
            setCheckMsg('');
          }}
        />
        <TouchableOpacity style={styles.checkBtn} onPress={handleCheckDuplicate}>
          <Text style={styles.checkBtnText}>중복체크</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.checkMsgRow}>
        {!!checkMsg && (
          <Text style={checkMsg === '중복체크 성공' ? styles.checkMsgSuccess : styles.checkMsgError}>
            {checkMsg}
          </Text>
        )}
      </View>
      <TextInput
        style={[styles.input, styles.fieldGap]}
        placeholder="클럽명"
        value={teamName}
        onChangeText={setTeamName}
      />
      <TextInput
        style={[styles.input, styles.fieldGap]}
        placeholder="정기모임일(요일)"
        value={teamDate}
        onChangeText={setTeamDate}
      />
      <TextInput
        style={[styles.input, styles.fieldGap]}
        placeholder="주요코트"
        value={teamCourt}
        onChangeText={setTeamCourt}
      />
      <TouchableOpacity 
        style={styles.registerBtn}
        onPress={handleRegister}
        disabled={!isChecked || !teamCode || !teamName || !teamDate || !teamCourt}
      >
        <Text style={styles.registerBtnText}>소속팀 등록</Text>
      </TouchableOpacity>
      <View style={styles.helpBox}>
        <Text style={styles.helpTitle}>도움말</Text>
        <Text style={styles.helpItem}><Text style={styles.helpLabel}>클럽코드(영문): </Text>클럽을 등록할 때 가장 중요한 정보입니다. 영문만으로 유일한 코드여야 하므로 중복체크 하면서 유일한 클럽코드를 입력해주세요.</Text>
        <Text style={styles.helpItem}><Text style={styles.helpLabel}>정기모임일(요일): </Text>정기모임일(또는 요일)을 text로 입력해주세요. ex) 매주 화, 목</Text>
        <Text style={styles.helpItem}><Text style={styles.helpLabel}>주요코트: </Text>주요 사용하는 코트를 text로 입력해주세요. ex) 서남물코트</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f7f7f7' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 16 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    fontSize: 16,
    marginBottom: 0,
    height: 48,
  },
  checkBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  checkBtnText: { color: '#fff', fontWeight: 'bold' },
  registerBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  registerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  fieldGap: { marginBottom: 16 },
  helpBox: {
    backgroundColor: '#e8f0fe',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  helpTitle: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  helpItem: {
    color: '#2563eb',
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  helpLabel: {
    fontWeight: 'bold',
    color: '#2563eb',
  },
  checkMsgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 18,
    marginBottom: 0,
  },
  checkMsgSuccess: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 0,
    marginTop: -6,
  },
  checkMsgError: {
    color: '#e11d48',
    fontSize: 12,
    marginLeft: 0,
    marginTop: -6,
  },
});

export default PremiumTeamRegisterScreen; 