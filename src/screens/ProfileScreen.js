import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getUserData } from '../services/firebaseService';
import { getAuth, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const db = getFirestore();

const ProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params || {};
  const [user, setUser] = useState(null);
  const [authName, setAuthName] = useState('');
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingWithdraw, setPendingWithdraw] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const passwordInputRef = useRef();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. 사용자 정보
        const userData = await getUserData(userId);
        setUser(userData);

        // 2. 권한 등급명
        if (userData?.authGroup) {
          const authDoc = await getDoc(doc(db, 'authGroup', userData.authGroup));
          if (authDoc.exists()) {
            setAuthName(authDoc.data().authName);
          }
        }

        // 3. 소속팀 정보
        if (userData?.userTeam) {
          const teamDoc = await getDoc(doc(db, 'teams', userData.userTeam));
          if (teamDoc.exists()) {
            setTeam(teamDoc.data());
          }
        }
      } catch (e) {
        // 에러 처리
      }
      setLoading(false);
    };
    if (userId) fetchData();
  }, [userId]);

  useEffect(() => {
    if (showPasswordModal) {
      console.log('[탈퇴] 모달 오픈, 상태:', { withdrawPassword, pendingWithdraw });
    }
  }, [showPasswordModal]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f8cff" />
      </View>
    );
  }

  // 탈퇴 처리 함수
  const handleWithdraw = async (password) => {
    try {
      console.log('[탈퇴] handleWithdraw 진입, userId:', userId, 'password:', password);
      if (!userId) {
        console.log('[탈퇴] userId 없음, 함수 종료');
        return;
      }
      // 1. Firestore에서 users 문서 삭제
      console.log('[탈퇴] Firestore users 문서 삭제 시도');
      await deleteDoc(doc(db, 'users', userId));
      // 2. Firebase Authentication에서 deleteUser
      const auth = getAuth();
      if (auth.currentUser && auth.currentUser.uid === userId) {
        console.log('[탈퇴] 재인증 및 deleteUser 시도');
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await deleteUser(auth.currentUser);
      } else {
        console.log('[탈퇴] auth.currentUser가 없거나 uid 불일치', auth.currentUser?.uid);
      }
      Alert.alert('완료', '탈퇴가 완료되었습니다.');
      if (typeof navigation !== 'undefined') {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } catch (e) {
      console.log('탈퇴 에러:', e);
      Alert.alert('오류', '탈퇴 처리 중 오류가 발생했습니다.\n비밀번호를 다시 확인해 주세요.');
    } finally {
      setShowPasswordModal(false);
      setWithdrawPassword('');
      setPendingWithdraw(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>기본 정보</Text>
      <View style={styles.infoBox}>
        <InfoRow label="이메일" value={user?.email || '-'} />
        <InfoRow label="이름" value={user?.userName || '-'} />
        <InfoRow
          label="성별"
          value={
            user?.userGender === 'male'
              ? '남'
              : user?.userGender === 'female'
              ? '여'
              : '-'
          }
        />
        <InfoRow label="연락처" value={user?.userHP || '-'} />
        <InfoRow label="구력(년수)" value={user?.expYears || '-'} />
        <InfoRow label="권한등급" value={authName || user?.authGroup || '-'} />
      </View>

      <Text style={styles.sectionTitle}>클럽 정보</Text>
      <View style={styles.infoBox}>
        <InfoRow label="클럽명" value={team?.teamName || '-'} />
        <InfoRow label="정기모임일(요일)" value={team?.teamDate || '-'} />
        <InfoRow label="주요코트" value={team?.teamCourt || '-'} />
        <InfoRow label="회원수" value={team?.memberCnt?.toString() || '-'} />
      </View>

      {/* 전적 정보 그룹 */}
      <Text style={styles.sectionTitle}>전적 정보</Text>
      <View style={styles.infoBox}>
        <InfoRow label="전투력" value={user?.ability?.toString() || '0'} />
        <InfoRow label="출석" value={user?.attendCnt?.toString() || '0'} />
        <InfoRow label="승" value={user?.winCnt?.toString() || '0'} />
        <InfoRow label="무" value={user?.drawCnt?.toString() || '0'} />
        <InfoRow label="패" value={user?.lossCnt?.toString() || '0'} />
      </View>
      {/* 전투력 갱신 버튼 */}
      <TouchableOpacity style={styles.renewBtn} onPress={async () => {
        if (!userId || !user) return;
        // 값 파싱
        const exp = parseFloat(user.expYears) || 0;
        const attend = parseInt(user.attendCnt) || 0;
        const win = parseInt(user.winCnt) || 0;
        const draw = parseInt(user.drawCnt) || 0;
        const loss = parseInt(user.lossCnt) || 0;
        let ability = exp * 100 + attend * 10 + win * 30 + draw * 20 + loss * 10;
        ability = Math.round(ability * 10) / 10; // 소수점 1자리 반올림
        try {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { ability });
          // 갱신 후 화면 데이터 다시 불러오기
          const userData = await getUserData(userId);
          setUser(userData);
          Alert.alert('완료', '전투력이 갱신되었습니다.');
        } catch (e) {
          Alert.alert('오류', '전투력 갱신에 실패했습니다.');
        }
      }}>
        <Text style={styles.renewBtnText}>전투력 갱신</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ position: 'absolute', right: 18, bottom: 12 }}
        onPress={() => {
          Alert.alert(
            '탈퇴 확인',
            '탈퇴하시면 전투력 등 데이터를 복구할 순 없습니다.\n탈퇴하시겠습니까?',
            [
              { text: '취소', style: 'cancel' },
              {
                text: '확인',
                style: 'destructive',
                onPress: () => {
                  setShowPasswordModal(true);
                  setPendingWithdraw(false);
                },
              },
            ]
          );
        }}
      >
        <Text style={{ color: '#888', fontSize: 13, textAlign: 'right', textDecorationLine: 'underline' }}>탈퇴하기</Text>
      </TouchableOpacity>
      {/* 비밀번호 입력 모달 */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setWithdrawPassword('');
          setPendingWithdraw(false);
        }}
      >
        <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.3)' }}>
          <View style={{ backgroundColor:'#fff', borderRadius:10, padding:24, width:300 }}>
            <Text style={{ fontSize:16, fontWeight:'bold', marginBottom:12 }}>비밀번호 확인</Text>
            <Text style={{ fontSize:14, color:'#444', marginBottom:12 }}>회원 탈퇴를 위해 비밀번호를 입력해 주세요.</Text>
            <TextInput
              ref={passwordInputRef}
              value={withdrawPassword}
              onChangeText={text => {
                console.log('[탈퇴] 비밀번호 입력:', text);
                setWithdrawPassword(text);
              }}
              placeholder="비밀번호"
              secureTextEntry
              style={{ borderWidth:1, borderColor:'#ccc', borderRadius:6, padding:10, marginBottom:16 }}
              autoFocus
            />
            <View style={{ flexDirection:'row', justifyContent:'flex-end' }}>
              <TouchableOpacity
                style={{ marginRight:12 }}
                onPress={() => {
                  console.log('[탈퇴] 비밀번호 모달 취소 버튼 클릭');
                  setShowPasswordModal(false);
                  setWithdrawPassword('');
                  setPendingWithdraw(false);
                }}
              >
                <Text style={{ color:'#888', fontSize:15 }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#2563eb',
                  borderRadius: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  opacity: pendingWithdraw ? 0.5 : 1,
                }}
                disabled={pendingWithdraw}
                onPress={async () => {
                  const realPassword = passwordInputRef.current?._lastNativeText ?? withdrawPassword;
                  console.log('[탈퇴] 버튼 클릭됨', { realPassword, pendingWithdraw });
                  if (!realPassword) {
                    Alert.alert('안내', '비밀번호를 입력해 주세요.');
                    return;
                  }
                  setWithdrawPassword(realPassword);
                  setPendingWithdraw(true);
                  await handleWithdraw(realPassword);
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f7f7f7',
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#4f8cff',
    marginBottom: 8,
    marginTop: 16,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    color: '#222',
    fontWeight: 'bold',
  },
  renewBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  renewBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen; 