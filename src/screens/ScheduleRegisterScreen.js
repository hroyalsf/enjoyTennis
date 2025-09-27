import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, SafeAreaView, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { getUserData } from '../services/firebaseService';
import DateTimePicker from '@react-native-community/datetimepicker';
import RNPickerSelect from 'react-native-picker-select';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from "react-native-modal-datetime-picker";

const db = getFirestore();

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 16,
    height: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#222',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  inputAndroid: {
    fontSize: 16,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#222',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  iconContainer: {
    top: 16,
    right: 12,
  },
  placeholder: {
    color: '#aaa',
  },
};

const presetPickerSelectStyles = {
  inputIOS: {
    fontSize: 16,
    height: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#222',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    marginBottom: 0,
  },
  inputAndroid: {
    fontSize: 16,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#222',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    marginBottom: 0,
  },
  iconContainer: {
    top: 16,
    right: 12,
  },
  placeholder: {
    color: '#aaa',
  },
};

const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ScheduleRegisterScreen = ({ route, navigation }) => {
  const { userId } = route.params || {};
  const [teamCourtSets, setTeamCourtSets] = useState([]);
  const [selectedCourtSetId, setSelectedCourtSetId] = useState('');
  const [courtSetData, setCourtSetData] = useState(null);
  const [userTeam, setUserTeam] = useState(null);

  const [date, setDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [dateText, setDateText] = useState(formatDate(new Date()));

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
        if (!teamDocRef) return;
        const courtSetColRef = collection(teamDocRef, 'teamCourtSet');
        const courtSetSnap = await getDocs(courtSetColRef);
        const sets = [];
        courtSetSnap.forEach(doc => {
          sets.push({ id: doc.id, ...doc.data() });
        });
        setTeamCourtSets(sets);
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

  const showDatepicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  const handleConfirm = (selectedDate) => {
    setDate(selectedDate);
    setDateText(formatDate(selectedDate));
    hideDatePicker();
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
      
      // Firebase에 데이터 저장 전, 중복 체크
      const teamDocRef = doc(db, 'teams', userTeam);
      const playPlanDocRef = doc(collection(teamDocRef, 'playPlan'), formattedDate);
      
      // 1. 이미 등록된 날짜가 있는지 확인
      const playPlanSnap = await getDoc(playPlanDocRef);
      if (playPlanSnap.exists()) {
        Alert.alert('중복 일정', '이미 등록된 날짜입니다.');
        return;
      }
      
      // 2. 등록 진행
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 팀 코트 세트 프리셋 카드 */}
      <View style={styles.presetCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons name="sparkles-outline" size={20} color="#2563eb" style={{ marginRight: 6 }} />
          <Text style={styles.presetLabel}>팀 코트 세트</Text>
        </View>
        <RNPickerSelect
          onValueChange={(value) => {
            setSelectedCourtSetId(value);
            if (!value) {
              setSelectedCourtId('');
              setCourtAddr('');
              setCourtNum('');
              setCourtTime('');
            }
          }}
          items={teamCourtSets.map(set => ({
            label: set.courtName,
            value: set.id
          }))}
          value={selectedCourtSetId}
          placeholder={{ label: '선택하세요', value: '' }}
          style={presetPickerSelectStyles}
          useNativeAndroidPickerStyle={false}
          Icon={() => <Ionicons name="chevron-down" size={20} color="#aaa" />}
        />
        <Text style={styles.presetDesc}>선택 시 아래 정보가 자동으로 채워집니다.</Text>
      </View>

      {/* 일정 정보 입력 섹션 */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>일정 정보</Text>
        
        <Text style={styles.label}>날짜</Text>
        <TouchableOpacity onPress={showDatepicker} style={styles.input}>
          <Text style={styles.inputText}>{dateText}</Text>
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirm}
          onCancel={hideDatePicker}
          date={date}
          locale="ko"
        />

        <Text style={styles.label}>코트</Text>
        <RNPickerSelect
          onValueChange={(value) => {
            setSelectedCourtId(value);
            if (!value) {
              setCourtAddr('');
              setCourtNum('');
              setCourtTime('');
            } else {
              const selected = courts.find(court => court.id === value);
              if (selected) {
                setCourtAddr(selected.courtAddr || '');
              }
            }
          }}
          items={courts.map(court => ({
            label: court.courtName,
            value: court.id
          }))}
          value={selectedCourtId}
          placeholder={{ label: '선택하세요', value: '' }}
          style={pickerSelectStyles}
          useNativeAndroidPickerStyle={false}
          Icon={() => <Ionicons name="chevron-down" size={20} color="#aaa" />}
        />

        <Text style={styles.label}>코트 주소</Text>
        <TextInput 
          style={[styles.input, styles.disabledInput]} 
          value={courtAddr} 
          editable={false} 
        />

        <Text style={styles.label}>코트 번호</Text>
        <TextInput 
          style={styles.input} 
          value={courtNum} 
          onChangeText={setCourtNum}
          placeholder="코트 번호를 입력하세요"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>코트 시간</Text>
        <TextInput 
          style={styles.input} 
          value={courtTime} 
          onChangeText={setCourtTime}
          placeholder="코트 시간을 입력하세요"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 등록 버튼 */}
      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.registerButtonText}>등록</Text>
      </TouchableOpacity>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  label: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  registerButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 0,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  presetCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  presetLabel: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1e40af',
  },
  presetDesc: {
    color: '#1e40af',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 2,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 6,
  },
  inputText: {
    fontSize: 15,
    color: '#111827',
  },
  disabledInput: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
});

export default ScheduleRegisterScreen;