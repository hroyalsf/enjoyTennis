import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { getUserData } from '../services/firebaseService';
import { Icon } from 'react-native-elements';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

const db = getFirestore();

const ScheduleListScreen = ({ route }) => {
  const { userId } = route.params || {};
  const [schedules, setSchedules] = useState([]);
  const [userTeam, setUserTeam] = useState('');
  const [userName, setUserName] = useState('');
  const [authGroup, setAuthGroup] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // 년/월 콤보박스 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 년/월 상태는 selectedDate에서 파생
  const selectedYear = selectedDate.getFullYear().toString();
  const selectedMonth = (selectedDate.getMonth() + 1).toString().padStart(2, '0');

  // 년/월 콤보박스용 데이터
  const years = Array.from({ length: 5 }, (_, i) => (selectedDate.getFullYear() - 2 + i).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  const loadUserData = async () => {
    try {
      const userData = await getUserData(userId);
      if (userData) {
        setUserTeam(userData.userTeam);
        setUserName(userData.userName);
        setAuthGroup(userData.authGroup || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('오류', '사용자 정보를 불러오는데 실패했습니다.');
    }
  };

  const loadSchedules = async (dateObj = selectedDate) => {
    if (!userTeam) return;
    const year = dateObj.getFullYear().toString();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    try {
      const playPlanRef = collection(doc(db, 'teams', userTeam), 'playPlan');
      const querySnapshot = await getDocs(playPlanRef);
      
      const scheduleData = [];
      querySnapshot.forEach((doc) => {
        // id는 YYYYMMDD 형식
        const id = doc.id;
        if (id.startsWith(year + month)) {
          scheduleData.push({
            id,
            ...doc.data()
          });
        }
      });

      // 날짜순으로 정렬
      scheduleData.sort((a, b) => a.id.localeCompare(b.id));
      setSchedules(scheduleData);
    } catch (error) {
      console.error('Error loading schedules:', error);
      Alert.alert('오류', '일정을 불러오는데 실패했습니다.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedules();
    setRefreshing(false);
  };

  useEffect(() => {
    loadUserData();
  }, [userId]);

  useEffect(() => {
    if (userTeam) {
      loadSchedules();
    }
  }, [userTeam]);

  const formatDate = (dateString) => {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}-${month}-${day}`;
  };

  const isDatePassed = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const year = parseInt(dateString.substring(0, 4));
    const month = parseInt(dateString.substring(4, 6)) - 1; // 월은 0부터 시작
    const day = parseInt(dateString.substring(6, 8));
    
    const scheduleDate = new Date(year, month, day);
    return scheduleDate < today;
  };

  const handleAttendance = async (scheduleId, isAttending) => {
    if (!userTeam || !userId || !userName) return;

    try {
      const scheduleRef = doc(db, 'teams', userTeam, 'playPlan', scheduleId);
      
      if (isAttending) {
        await updateDoc(scheduleRef, {
          members: arrayUnion({ userId, userName })
        });
      } else {
        await updateDoc(scheduleRef, {
          members: arrayRemove({ userId, userName })
        });
      }

      // 화면 새로고침
      await loadSchedules();
      Alert.alert('성공', isAttending ? '참석 처리되었습니다.' : '미참석 처리되었습니다.');
    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('오류', '참석 상태 업데이트에 실패했습니다.');
    }
  };

  // 달력에서 날짜 선택 시
  const onChangeDate = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      // 날짜 선택 시 바로 일정 조회
      loadSchedules(date);
    }
  };

  // 일정 삭제
  const handleDelete = async (scheduleId) => {
    Alert.alert(
      '일정 삭제',
      '정말로 이 일정을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const scheduleRef = doc(db, 'teams', userTeam, 'playPlan', scheduleId);
              await deleteDoc(scheduleRef);
              await loadSchedules();
              Alert.alert('삭제 완료', '일정이 삭제되었습니다.');
            } catch (error) {
              console.error('Error deleting schedule:', error);
              Alert.alert('오류', '일정 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isAttending = (item.members || []).some(member => member.userId === userId);
    const attendees = (item.members || []).map(member => member.userName).join(', ');
    const isPast = isDatePassed(item.id);

    return (
      <View style={styles.card}>
        {/* 삭제 버튼: 관리자만 표시 */}
        {authGroup.startsWith('ADM') && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteButtonText}>×</Text>
          </TouchableOpacity>
        )}
        <View style={styles.dateContainer}>
          <Icon
            name="calendar"
            type="feather"
            size={20}
            color={isPast ? '#999' : '#007AFF'}
            style={styles.icon}
          />
          <Text style={[styles.dateText, isPast && styles.pastDateText]}>
            {formatDate(item.id)}
            {isPast && ' (지난 일정)'}
          </Text>
        </View>
        
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Icon
              name="map-pin"
              type="feather"
              size={16}
              color="#666"
              style={styles.icon}
            />
            <Text style={styles.infoText}>코트: {item.courtName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon
              name="hash"
              type="feather"
              size={16}
              color="#666"
              style={styles.icon}
            />
            <Text style={styles.infoText}>코트 번호: {item.courtNum}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon
              name="clock"
              type="feather"
              size={16}
              color="#666"
              style={styles.icon}
            />
            <Text style={styles.infoText}>시간: {item.courtTime}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon
              name="users"
              type="feather"
              size={16}
              color="#666"
              style={styles.icon}
            />
            <Text style={styles.infoText}>참석인원: {attendees || '없음'}</Text>
          </View>
        </View>
        
        {!isPast ? (
          <TouchableOpacity
            style={[
              styles.attendButton,
              isAttending ? styles.attendingButton : styles.notAttendingButton
            ]}
            onPress={() => handleAttendance(item.id, !isAttending)}
          >
            <Icon
              name={isAttending ? 'user-minus' : 'user-plus'}
              type="feather"
              size={20}
              color="#fff"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>
              {isAttending ? '미참석' : '참석'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.attendButton, styles.disabledButton]}>
            <Icon
              name="lock"
              type="feather"
              size={20}
              color="#999"
              style={styles.buttonIcon}
            />
            <Text style={styles.disabledButtonText}>참석 변경 불가</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* 년/월 콤보박스 + 검색 버튼 */}
        <View style={styles.calendarRow}>
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Icon name="calendar" type="feather" size={20} color="#007AFF" />
            <Text style={styles.calendarButtonText}>
              {selectedYear}년 {selectedMonth}월
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChangeDate}
            />
          )}
        </View>
        <FlatList
          data={schedules}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
          contentContainerStyle={styles.listContainer}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  infoContainer: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
    width: 20,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  attendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  attendingButton: {
    backgroundColor: '#FF3B30',
  },
  notAttendingButton: {
    backgroundColor: '#007AFF',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pastDateText: {
    color: '#999',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  disabledButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarButtonText: {
    marginLeft: 8,
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#ff3b30',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 24 : 8,
    marginBottom: 8,
    zIndex: 10,
  },
});

export default ScheduleListScreen; 