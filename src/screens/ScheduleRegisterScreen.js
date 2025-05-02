import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { getUserData } from '../services/firebaseService';
import DateTimePicker from '@react-native-community/datetimepicker';

const db = getFirestore();

const ScheduleRegisterScreen = ({ route, navigation }) => {
  const { userId } = route.params || {};
  const [teamCourtSets, setTeamCourtSets] = useState([]);
  const [selectedCourtSetId, setSelectedCourtSetId] = useState('');
  const [courtSetData, setCourtSetData] = useState(null);
  const [userTeam, setUserTeam] = useState(null);

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dateText, setDateText] = useState('날짜를 선택하세요');

  const [courts, setCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [courtAddr, setCourtAddr] = useState('');

  const [courtNum, setCourtNum] = useState('');
  const [courtTime, setCourtTime] = useState('');

  // 1. 사용자의 팀 정보 가져오기
  useEffect(() => {
    const fetchUserTeam = async () => {
      if (!userId) return;
      try {
        const userData = await getUserData(userId);
        if (userData?.userTeam) {
          setUserTeam(userData.userTeam);
        }
      } catch (error) {
        console.error('Error fetching user team:', error);
      }
    };
    fetchUserTeam();
  }, [userId]);

  // 2. 팀의 teamCourtSet 불러오기
  useEffect(() => {
    const fetchTeamCourtSets = async () => {
      if (!userTeam) return;
      try {
        const teamDocRef = doc(db, 'teams', userTeam);
        const teamDocSnap = await getDoc(teamDocRef);
        if (teamDocSnap.exists()) {
          const courtSetColRef = collection(teamDocRef, 'teamCourtSet');
          const courtSetSnap = await getDocs(courtSetColRef);
          const sets = [];
          courtSetSnap.forEach(doc => {
            sets.push({ id: doc.id, ...doc.data() });
          });
          setTeamCourtSets(sets);
        }
      } catch (error) {
        console.error('Error fetching team court sets:', error);
      }
    };
    fetchTeamCourtSets();
  }, [userTeam]);

  // 3. courtM 전체 불러오기
  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const courtColRef = collection(db, 'courtM');
        const courtSnap = await getDocs(courtColRef);
        const courtsArr = [];
        courtSnap.forEach(doc => {
          courtsArr.push({ id: doc.id, ...doc.data() });
        });
        setCourts(courtsArr);
      } catch (error) {
        console.error('Error fetching courts:', error);
      }
    };
    fetchCourts();
  }, []);

  // 4. teamCourtSet 선택 시 값 자동 셋팅
  useEffect(() => {
    if (!selectedCourtSetId) return;
    const selected = teamCourtSets.find(set => set.id === selectedCourtSetId);
    if (selected && courts.length > 0) {
      setCourtSetData(selected);
      
      // 코트 이름으로 매칭하여 자동 선택
      const selectedCourt = courts.find(court => court.courtName === selected.courtName);
      if (selectedCourt) {
        setSelectedCourtId(selectedCourt.id);
        setCourtAddr(selectedCourt.courtAddr || '');
      }
      
      setCourtNum(selected.courtNum || '');
      setCourtTime(selected.courtTime || '');
    }
  }, [selectedCourtSetId, teamCourtSets, courts]);

  // 5. 코트 선택 시 courtAddr 자동 셋팅
  useEffect(() => {
    if (!selectedCourtId) return;
    const selected = courts.find(court => court.id === selectedCourtId);
    if (selected) {
      setCourtAddr(selected.courtAddr || '');
    }
  }, [selectedCourtId, courts]);

  const onChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setDateText(formattedDate);
    }
  };

  const showDatepicker = () => {
    setShowPicker(true);
  };

  const handleRegister = async () => {
    if (!dateText || dateText === '날짜를 선택하세요') {
      Alert.alert('알림', '날짜를 선택해주세요.');
      return;
    }
    if (!selectedCourtId) {
      Alert.alert('알림', '코트를 선택해주세요.');
      return;
    }
    if (!courtNum) {
      Alert.alert('알림', '코트 번호를 입력해주세요.');
      return;
    }
    if (!courtTime) {
      Alert.alert('알림', '코트 시간을 입력해주세요.');
      return;
    }

    try {
      // 선택된 코트 정보 가져오기
      const selectedCourt = courts.find(court => court.id === selectedCourtId);
      
      // 날짜 형식 변환 (YYYYMMDD)
      const formattedDate = dateText.replace(/-/g, '');
      
      // Firebase에 데이터 저장
      const teamDocRef = doc(db, 'teams', userTeam);
      const playPlanDocRef = doc(collection(teamDocRef, 'playPlan'), formattedDate);
      
      await setDoc(playPlanDocRef, {
        courtName: selectedCourt.courtName,
        courtNum: courtNum,
        courtTime: courtTime,
        createdAt: new Date()
      });

      Alert.alert('성공', '일정이 등록되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error registering schedule:', error);
      Alert.alert('오류', '일정 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>팀 코트 세트</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedCourtSetId}
          onValueChange={setSelectedCourtSetId}
          style={styles.picker}
        >
          <Picker.Item label="선택하세요" value="" />
          {teamCourtSets.map(set => (
            <Picker.Item key={set.id} label={set.courtName} value={set.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>날짜</Text>
      <TouchableOpacity onPress={showDatepicker} style={styles.input}>
        <Text>{dateText}</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode="date"
          is24Hour={true}
          onChange={onChange}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        />
      )}

      <Text style={styles.label}>코트</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedCourtId}
          onValueChange={setSelectedCourtId}
          style={styles.picker}
        >
          <Picker.Item label="선택하세요" value="" />
          {courts.map(court => (
            <Picker.Item key={court.id} label={court.courtName} value={court.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>코트 주소</Text>
      <TextInput 
        style={[styles.input, { backgroundColor: '#eee' }]} 
        value={courtAddr} 
        editable={false} 
      />

      <Text style={styles.label}>코트 번호</Text>
      <TextInput 
        style={styles.input} 
        value={courtNum} 
        onChangeText={setCourtNum}
        placeholder="코트 번호를 입력하세요"
      />

      <Text style={styles.label}>코트 시간</Text>
      <TextInput 
        style={styles.input} 
        value={courtTime} 
        onChangeText={setCourtTime}
        placeholder="코트 시간을 입력하세요"
      />

      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.registerButtonText}>등록</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  registerButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScheduleRegisterScreen;