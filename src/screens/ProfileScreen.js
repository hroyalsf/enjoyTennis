import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList, KeyboardAvoidingView } from 'react-native';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc, setDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getUserData } from '../services/firebaseService';
import { getAuth, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';

const db = getFirestore();
const REVENUECAT_API_KEY = Constants.expoConfig.extra.revenueCatApiKey;

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
  
  // 팀 검색 관련 상태
  const [showTeamSearchModal, setShowTeamSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // RevenueCat 관련 상태
  const [products, setProducts] = useState([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  
  // 클럽 생성 관련 상태
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [clubCode, setClubCode] = useState('');
  const [clubName, setClubName] = useState('');
  const [clubDate, setClubDate] = useState('');
  const [clubCourt, setClubCourt] = useState('');
  const [clubComment, setClubComment] = useState('');
  const [isCodeChecking, setIsCodeChecking] = useState(false);
  const [isCodeAvailable, setIsCodeAvailable] = useState(null);

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

  // RevenueCat 초기화
  useEffect(() => {
    const initializePurchases = async () => {
      if (!REVENUECAT_API_KEY) {
        console.log("RevenueCat API Key is not set in app.json.");
        return;
      }
      try {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        
        // offerings 가져오기
        const offerings = await Purchases.getOfferings();
        if (offerings.current && offerings.current.availablePackages.length > 0) {
          setProducts(offerings.current.availablePackages);
        }
        console.log("RevenueCat initialized successfully");
      } catch (error) {
        console.error("RevenueCat initialization error:", error);
      }
    };
    initializePurchases();
  }, []);

  useEffect(() => {
    if (showPasswordModal) {
      console.log('[탈퇴] 모달 오픈, 상태:', { withdrawPassword, pendingWithdraw });
    }
  }, [showPasswordModal]);

  // 팀 검색 함수
  const searchTeams = async () => {
    setSearchLoading(true);
    try {
      const teamsRef = collection(db, 'teams');
      let teamsList = [];
      
      if (searchQuery.trim()) {
        // 검색어가 있는 경우: 팀명과 팀코드(문서ID) 모두 검색
        const searchTerm = searchQuery.trim();
        
        // 1. 팀명으로 검색
        const nameQuery = query(
          teamsRef,
          where('teamName', '>=', searchTerm),
          where('teamName', '<=', searchTerm + '\uf8ff'),
          orderBy('teamName')
        );
        
        // 2. 문서ID로 검색 (정확히 일치하는 경우)
        const idQuery = query(
          teamsRef,
          where('__name__', '==', searchTerm)
        );
        
        // 두 쿼리 모두 실행
        const [nameSnapshot, idSnapshot] = await Promise.all([
          getDocs(nameQuery).catch(() => ({ docs: [] })),
          getDocs(idQuery).catch(() => ({ docs: [] }))
        ]);
        
        // 결과 합치기 (중복 제거)
        const foundTeams = new Map();
        
        nameSnapshot.docs.forEach((doc) => {
          foundTeams.set(doc.id, {
            id: doc.id,
            ...doc.data()
          });
        });
        
        idSnapshot.docs.forEach((doc) => {
          foundTeams.set(doc.id, {
            id: doc.id,
            ...doc.data()
          });
        });
        
        teamsList = Array.from(foundTeams.values());
      } else {
        // 검색어가 없는 경우: 모든 팀 조회
        const q = query(teamsRef, orderBy('teamName'));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          teamsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
      }
      
      setTeams(teamsList);
      setFilteredTeams(teamsList);
    } catch (error) {
      console.error('팀 검색 오류:', error);
      Alert.alert('오류', '팀 검색 중 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  // 팀 선택 및 가입신청
  const handleTeamJoin = async (selectedTeam) => {
    try {
      // userTeam과 userStat 상태 체크
      if (user?.userTeam && user?.userStat === 200) {
        Alert.alert('알림', '이미 클럽 가입된 상태입니다.');
        return;
      }

      if (user?.userTeam && user?.userStat !== 200) {
        Alert.alert(
          '가입신청 확인',
          '이미 클럽 가입신청을 하셨습니다. 지금 클럽으로 다시 가입신청하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '확인',
              onPress: async () => {
                await processTeamJoin(selectedTeam);
              }
            }
          ]
        );
        return;
      }

      // userTeam이 없는 경우
      Alert.alert(
        '가입신청',
        `${selectedTeam.teamName}에 가입신청하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '확인',
            onPress: async () => {
              await processTeamJoin(selectedTeam);
            }
          }
        ]
      );
    } catch (error) {
      console.error('가입신청 오류:', error);
      Alert.alert('오류', '가입신청 중 오류가 발생했습니다.');
    }
  };

  // 실제 가입신청 처리 함수
  const processTeamJoin = async (selectedTeam) => {
    try {
      // Firebase users 컬렉션에 userTeam과 userStat 업데이트
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        userTeam: selectedTeam.id,
        userStat: 100
      });
      
      // 로컬 상태도 업데이트
      setUser(prev => ({
        ...prev,
        userTeam: selectedTeam.id,
        userStat: 100
      }));
      
      Alert.alert('성공', '가입신청이 완료되었습니다.');
      setShowTeamSearchModal(false);
      setSearchQuery('');
    } catch (error) {
      console.error('가입신청 저장 오류:', error);
      Alert.alert('오류', '가입신청 저장 중 오류가 발생했습니다.');
    }
  };

  // 클럽코드 중복체크 함수
  const checkClubCodeAvailability = async () => {
    if (!clubCode.trim()) {
      Alert.alert('입력 오류', '클럽코드를 입력해주세요.');
      return;
    }
    
    // 영문만 허용 체크
    if (!/^[a-zA-Z]+$/.test(clubCode)) {
      Alert.alert('입력 오류', '클럽코드는 영문만 입력 가능합니다.');
      return;
    }
    
    setIsCodeChecking(true);
    try {
      const teamDoc = await getDoc(doc(db, 'teams', clubCode));
      if (teamDoc.exists()) {
        setIsCodeAvailable(false);
        Alert.alert('사용 불가', '이미 사용 중인 클럽코드입니다.');
      } else {
        setIsCodeAvailable(true);
        Alert.alert('사용 가능', '사용 가능한 클럽코드입니다.');
      }
    } catch (error) {
      console.error('클럽코드 체크 오류:', error);
      Alert.alert('오류', '클럽코드 확인 중 오류가 발생했습니다.');
    } finally {
      setIsCodeChecking(false);
    }
  };

  // 클럽 생성 처리 함수
  const handleCreateClub = async () => {
    if (!clubCode.trim() || !clubName.trim() || !clubDate.trim() || !clubCourt.trim()) {
      Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요.');
      return;
    }
    
    if (isCodeAvailable !== true) {
      Alert.alert('입력 오류', '클럽코드 중복체크를 완료해주세요.');
      return;
    }
    
    try {
      // 1. teams 컬렉션에 클럽 생성
      await setDoc(doc(db, 'teams', clubCode), {
        teamName: clubName,
        teamDate: clubDate,
        teamCourt: clubCourt,
        teamComment: clubComment,
        memberCnt_rest: 5,
        memberCnt: 1,
        createdAt: new Date()
      });
      
      // 2. users 컬렉션에 사용자 정보 업데이트
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        authGroup: 'ADM01',
        userTeam: clubCode,
        userStat: 200
      });
      
      // 3. 로컬 상태 업데이트
      setUser(prev => ({
        ...prev,
        authGroup: 'ADM01',
        userTeam: clubCode,
        userStat: 200
      }));
      
      // 4. 모달 닫기 및 상태 초기화
      setShowCreateClubModal(false);
      setClubCode('');
      setClubName('');
      setClubDate('');
      setClubCourt('');
      setClubComment('');
      setIsCodeAvailable(null);
      
      Alert.alert('성공', '클럽이 성공적으로 생성되었습니다!', [
        {
          text: '확인',
          onPress: () => {
            // 메인화면으로 이동하여 권한그룹 변경사항 반영
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main', params: { userId: userId } }],
            });
          }
        }
      ]);
    } catch (error) {
      console.error('클럽 생성 오류:', error);
      Alert.alert('오류', '클럽 생성 중 오류가 발생했습니다.');
    }
  };

  // 클럽 생성 인앱결제 처리 함수
  const handleCreateClubPurchase = async () => {
    // TODO: EAS 빌드 시 인앱결제 로직 활성화
    // 현재는 테스트를 위해 바로 클럽 생성 모달 표시
    
    Alert.alert(
      '클럽 생성',
      '클럽을 생성하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '생성하기',
          onPress: () => {
            setShowCreateClubModal(true);
          }
        }
      ]
    );
    
    // EAS 빌드 시 사용할 인앱결제 로직
    if (isPurchasing) return;
    
    // 먼저 confirm 창 표시
    Alert.alert(
      '클럽 생성 (유료)',
      '클럽을 생성하시겠습니까?\n유료 서비스입니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            // Expo Go에서 테스트용 처리
            if (products.length === 0) {
              // Expo Go에서는 인앱결제가 제한되므로 테스트용으로 바로 클럽 생성 팝업 표시
              setShowCreateClubModal(true);
              return;
            }
            
            // create_team 상품 찾기
            const createTeamProduct = products.find(pkg => pkg.product.identifier === 'create_team');
            if (!createTeamProduct) {
              Alert.alert('상품 없음', '클럽 생성 상품을 찾을 수 없습니다.');
              return;
            }
            
            setIsPurchasing(true);
            try {
              // RevenueCat을 사용한 인앱결제
              const { customerInfo } = await Purchases.purchasePackage(createTeamProduct);
              
              if (customerInfo.entitlements.active['create_team']) {
                // 결제 성공 시 바로 클럽 생성 팝업 표시 (별도 확인창 없음)
                setShowCreateClubModal(true);
              } else {
                Alert.alert('결제 실패', '결제가 완료되지 않았습니다.');
              }
            } catch (error) {
              console.error('인앱결제 오류:', error);
              if (error.userCancelled) {
                Alert.alert('결제 취소', '결제가 취소되었습니다.');
              } else {
                Alert.alert('결제 오류', '결제 중 오류가 발생했습니다.');
              }
            } finally {
              setIsPurchasing(false);
            }
          }
        }
      ]
    );
  };

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
      {/* authGroup에 따른 버튼 표시 */}
      {user?.authGroup === 'BAS02' ? (
        // BAS02인 경우: 클럽 가입신청, 클럽 생성(유료) 버튼
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.clubBtn} onPress={() => {
            setShowTeamSearchModal(true);
            setSearchQuery('');
            setTeams([]);
            setFilteredTeams([]);
          }}>
            <Text style={styles.clubBtnText}>클럽 가입신청</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clubBtn, styles.premiumBtn]} onPress={handleCreateClubPurchase}>
            <Text style={[styles.clubBtnText, styles.premiumBtnText]}>클럽 생성(유료)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // BAS02가 아닌 경우: 전투력 갱신 버튼
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
      )}
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

      {/* 팀 검색 모달 */}
      <Modal
        visible={showTeamSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowTeamSearchModal(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.teamSearchModal}>
            <Text style={styles.modalTitle}>클럽 검색</Text>
            
            {/* 검색 입력창 */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="클럽명 또는 클럽코드로 검색"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.searchButton} onPress={searchTeams}>
                <Text style={styles.searchButtonText}>검색</Text>
              </TouchableOpacity>
            </View>

            {/* 팀 리스트 */}
            <View style={styles.teamListContainer}>
              {searchLoading ? (
                <ActivityIndicator size="large" color="#4f8cff" style={styles.loadingIndicator} />
              ) : (
                <FlatList
                  data={filteredTeams}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.teamItem}
                      onPress={() => handleTeamJoin(item)}
                    >
                      <Text style={styles.teamName}>{item.teamName} ({item.id})</Text>
                      <Text style={styles.teamInfo}>정기모임일: {item.teamDate || '-'}</Text>
                      <Text style={styles.teamInfo}>주요코트: {item.teamCourt || '-'}</Text>
                      <Text style={styles.teamInfo}>회원수: {item.memberCnt || 0}명</Text>
                      {item.teamComment && (
                        <Text style={styles.teamInfo}>설명: {item.teamComment}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>

            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTeamSearchModal(false);
                setSearchQuery('');
              }}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 클럽 생성 모달 */}
      <Modal
        visible={showCreateClubModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateClubModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior="padding"
            keyboardVerticalOffset={50}
          >
            <View style={styles.createClubModal}>
            <Text style={styles.createClubModalTitle}>클럽 생성</Text>
            
            {/* 클럽코드 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>클럽코드 *</Text>
              <View style={styles.codeInputContainer}>
                <TextInput
                  style={styles.codeInput}
                  value={clubCode}
                  onChangeText={(text) => {
                    setClubCode(text);
                    setIsCodeAvailable(null);
                  }}
                  placeholder="영문만 입력"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[
                    styles.checkButton,
                    isCodeChecking && styles.checkButtonDisabled
                  ]}
                  onPress={checkClubCodeAvailability}
                  disabled={isCodeChecking}
                >
                  <Text style={styles.checkButtonText}>
                    {isCodeChecking ? '확인중...' : '중복체크'}
                  </Text>
                </TouchableOpacity>
              </View>
              {isCodeAvailable === true && (
                <Text style={styles.successText}>✓ 사용 가능한 클럽코드입니다</Text>
              )}
              {isCodeAvailable === false && (
                <Text style={styles.errorText}>✗ 이미 사용 중인 클럽코드입니다</Text>
              )}
            </View>

            {/* 클럽명 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>클럽명 *</Text>
              <TextInput
                style={styles.input}
                value={clubName}
                onChangeText={setClubName}
                placeholder="클럽명을 입력하세요"
                placeholderTextColor="#999"
              />
            </View>

            {/* 정기모임일 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>정기모임일(요일) *</Text>
              <TextInput
                style={styles.input}
                value={clubDate}
                onChangeText={setClubDate}
                placeholder="예: 매주 토요일"
                placeholderTextColor="#999"
              />
            </View>

            {/* 주요코트 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>주요코트 *</Text>
              <TextInput
                style={styles.input}
                value={clubCourt}
                onChangeText={setClubCourt}
                placeholder="주요 코트를 입력하세요"
                placeholderTextColor="#999"
              />
            </View>

            {/* 설명 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={clubComment}
                onChangeText={setClubComment}
                placeholder="클럽에 대한 설명을 입력하세요"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* 버튼들 */}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateClubModal(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateClub}
              >
                <Text style={styles.createButtonText}>클럽 생성</Text>
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAvoidingView>
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
  buttonContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  clubBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  clubBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  premiumBtn: {
    backgroundColor: '#10b981',
  },
  premiumBtnText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamSearchModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  teamListContainer: {
    maxHeight: 400,
    marginBottom: 16,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  teamItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  teamInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  closeButton: {
    backgroundColor: '#6c757d',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // 클럽 생성 모달 스타일
  createClubModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 320,
    maxWidth: '90%',
    maxHeight: '80%',
  },
  createClubModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
  },
  checkButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  successText: {
    color: '#28a745',
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileScreen; 