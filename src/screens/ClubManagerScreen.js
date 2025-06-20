import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList, Alert, StyleSheet,
  ActivityIndicator, ScrollView
} from 'react-native';
import { db } from '../services/firebaseService';
import {
  doc, getDoc, updateDoc, collection, addDoc, setDoc, getDocs, query, where,
  orderBy, limit, startAfter, increment
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const REVENUECAT_API_KEY = Constants.expoConfig.extra.revenueCatApiKey;

const ClubManagerScreen = ({ route }) => {
  // Navigation
  const { userTeam } = route.params || {};

  // Team Info
  const [teamInfo, setTeamInfo] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editCourt, setEditCourt] = useState('');
  
  // Modals
  const [courtModal, setCourtModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [showRestHelp, setShowRestHelp] = useState(false);
  
  // Forms & Lists
  const [courtForm, setCourtForm] = useState({ courtName: '', courtAddr: '', courtNum: '', courtTime: '' });
  const [members, setMembers] = useState([]);
  const [memberAuthNames, setMemberAuthNames] = useState({});
  const [lastDoc, setLastDoc] = useState(null);
  const [sortKey, setSortKey] = useState('ability');
  
  // Loading & State
  const [loading, setLoading] = useState(false);

  // RevenueCat In-App Purchase
  const [products, setProducts] = useState([]);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // --- DATA FETCHING & INITIALIZATION ---

  const fetchTeam = async () => {
    if (!userTeam) return;
    try {
      const snap = await getDoc(doc(db, 'teams', userTeam));
      if (snap.exists()) {
        const data = snap.data();
        setTeamInfo({ id: snap.id, ...data });
        setEditDate(data.teamDate || '');
        setEditCourt(data.teamCourt || '');
      }
    } catch (error) {
      console.error("Error fetching team info:", error);
      Alert.alert("오류", "팀 정보를 불러오는 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [userTeam]);

  useEffect(() => {
    const initializePurchases = async () => {
      if (!REVENUECAT_API_KEY) {
        console.log("RevenueCat API Key is not set in app.json.");
        return;
      }
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });

      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current && offerings.current.availablePackages.length > 0) {
          setProducts(offerings.current.availablePackages);
        }
      } catch (e) {
        console.log("Could not fetch offerings, this is expected if none are configured:", e.message);
      }
    };
    initializePurchases();
  }, []);

  // --- HANDLERS ---

  const handleSaveTeam = async () => {
    if (!userTeam) return;
    try {
      await updateDoc(doc(db, 'teams', userTeam), {
        teamDate: editDate,
        teamCourt: editCourt,
      });
      Alert.alert('저장 완료', '팀 정보가 저장되었습니다.');
    } catch (error) {
      console.error("Error saving team info:", error);
      Alert.alert("오류", "팀 정보 저장 중 오류가 발생했습니다.");
    }
  };

  const handleSaveCourtSet = async () => {
    if (!courtForm.courtName || !courtForm.courtAddr || !courtForm.courtNum || !courtForm.courtTime) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    try {
      const courtSetRef = collection(db, 'teams', userTeam, 'teamCourtSet');
      const courtSetDoc = await addDoc(courtSetRef, { ...courtForm });
      await setDoc(doc(db, 'courtM', courtSetDoc.id), {
        courtName: courtForm.courtName,
        courtAddr: courtForm.courtAddr,
      });
      Alert.alert('성공', '팀 코트 세트 저장에 성공했습니다.');
      setCourtModal(false);
      setCourtForm({ courtName: '', courtAddr: '', courtNum: '', courtTime: '' });
    } catch (error) {
      console.error("Error saving court set:", error);
      Alert.alert("오류", "코트 세트 저장 중 오류가 발생했습니다.");
    }
  };

  const handleBuyMemberCnt = async () => {
    if (isPurchasing) return;
    if (products.length === 0) {
      Alert.alert('상품 준비 중', '현재 구매 가능한 상품이 없습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    setIsPurchasing(true);
    try {
      const packageToPurchase = products[0];
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      const entitlementId = 'add_10_members'; 
      if (typeof customerInfo.entitlements.active[entitlementId] !== "undefined") {
        const teamRef = doc(db, 'teams', userTeam);
        await updateDoc(teamRef, { memberCnt_rest: increment(10) });
        await fetchTeam();
        Alert.alert('구매 완료', '잔여회원수가 10 증가했습니다.');
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert('결제 실패', '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        console.log("Purchase Error: ", e);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleMemberApproval = async (member) => {
    let actionText = '';
    let newAuthGroup = '';
    let newUserStat = member.userStat;

    if (Number(member.userStat) === 100) {
        actionText = `${member.userName} 가입을 승인하시겠습니까?`;
        newUserStat = 200;
    } else if (Number(member.userStat) === 200 && member.authGroup === 'BAS01') {
        actionText = `${member.userName}님을 지정관리자로 승격하시겠습니까?`;
        newAuthGroup = 'ADM02';
    } else {
        return; // No action
    }

    Alert.alert('확인', actionText, [
        { text: '취소', style: 'cancel' },
        {
            text: '확인',
            onPress: async () => {
                try {
                    const updateData = { userStat: newUserStat };
                    if (newAuthGroup) {
                        updateData.authGroup = newAuthGroup;
                    }
                    await updateDoc(doc(db, 'users', member.id), updateData);
                    fetchMembers(false); // Refresh list
                } catch (error) {
                    console.error("Error updating member:", error);
                    Alert.alert("오류", "회원 정보 업데이트 중 오류가 발생했습니다.");
                }
            }
        }
    ]);
  };

  // --- MEMBER LIST LOGIC ---

  const fetchMembers = async (nextPage = false) => {
    if(loading) return;
    setLoading(true);
    try {
        let q = query(
          collection(db, 'users'),
          where('userTeam', '==', userTeam),
          orderBy('userName'),
          limit(10)
        );
        if (nextPage && lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMembers(nextPage ? [...members, ...list] : list);
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
    } catch(error) {
        console.error("Error fetching members:", error);
    } finally {
        setLoading(false);
    }
  };
  
  useEffect(() => {
    const syncAuthNames = async () => {
      const authNames = {};
      await Promise.all(members.map(async (member) => {
        if (member.authGroup) {
          try {
            const authDoc = await getDoc(doc(db, 'authGroup', member.authGroup));
            authNames[member.id] = authDoc.exists() ? authDoc.data().authName : member.authGroup;
          } catch {
            authNames[member.id] = member.authGroup;
          }
        }
      }));
      setMemberAuthNames(authNames);
    };
    if (members.length > 0) syncAuthNames();
  }, [members]);


  // --- RENDER ---

  const renderMemberItem = ({ item }) => (
    <View style={styles.memberCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginRight: 8 }}>{item.userName}</Text>
            <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 13, marginRight: 8 }}>{item.userGender === 'male' ? '남' : '여'}</Text>
            <Text style={{ color: '#888', fontSize: 13, marginRight: 8 }}>{item.expYears}년</Text>
            <Text style={{ color: '#10b981', fontSize: 13, marginRight: 8 }}>{memberAuthNames[item.id] || item.authGroup || '-'}</Text>
            <TouchableOpacity onPress={() => handleMemberApproval(item)}>
                <Text style={{ color: Number(item.userStat) === 200 ? '#f59e42' : '#888', fontSize: 13, textDecorationLine: 'underline' }}>
                    {Number(item.userStat) === 200 ? '정회원' : Number(item.userStat) === 100 ? '준회원' : '-'}
                </Text>
            </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={styles.memberStat}>전투력: <Text style={{ fontWeight: 'bold' }}>{item.ability || 0}</Text></Text>
            <Text style={styles.memberStat}>출석: <Text style={{ fontWeight: 'bold' }}>{item.attendCnt || 0}</Text></Text>
            <Text style={styles.memberStat}>승: <Text style={{ fontWeight: 'bold' }}>{item.winCnt || 0}</Text></Text>
            <Text style={styles.memberStat}>무: <Text style={{ fontWeight: 'bold' }}>{item.drawCnt || 0}</Text></Text>
            <Text style={styles.memberStat}>패: <Text style={{ fontWeight: 'bold' }}>{item.lossCnt || 0}</Text></Text>
        </View>
        <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>연락처: {item.userHP}</Text>
    </View>
  );

  const sortedMembers = [...members].sort((a, b) => {
      if ((a.userStat === 100 ? 0 : 1) !== (b.userStat === 100 ? 0 : 1)) {
          return (a.userStat === 100 ? -1 : 1);
      }
      if (sortKey === 'userName') return a.userName.localeCompare(b.userName);
      return (b[sortKey] || 0) - (a[sortKey] || 0);
  });
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>기본 정보 관리</Text>
      {teamInfo ? (
        <View style={styles.infoBox}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>클럽코드</Text><Text style={styles.infoValueAlign}>{teamInfo.id}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>클럽명</Text><Text style={styles.infoValueAlign}>{teamInfo.teamName}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>회원수</Text><Text style={styles.infoValueAlign}>{teamInfo.memberCnt}</Text></View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>잔여회원수</Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.infoValueAlign, { flex: undefined }]}>{teamInfo.memberCnt_rest}</Text>
              <TouchableOpacity onPress={() => setShowRestHelp(true)} style={{ marginLeft: 4 }}>
                <Ionicons name="help-circle-outline" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>정기모임일</Text><TextInput value={editDate} onChangeText={setEditDate} placeholder="정기모임일" style={styles.inputActive} placeholderTextColor="#888" /></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>주요코트</Text><TextInput value={editCourt} onChangeText={setEditCourt} placeholder="주요코트" style={styles.inputActive} placeholderTextColor="#888" /></View>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.buyBtn} onPress={handleBuyMemberCnt} disabled={isPurchasing}><Text style={styles.buyBtnText}>{isPurchasing ? '처리 중...' : '잔여회원수 구매'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTeam}><Text style={styles.saveBtnText}>저장</Text></TouchableOpacity>
        </View>
      ) : <ActivityIndicator style={{ marginVertical: 24 }} size="large" />}

      <TouchableOpacity style={styles.actionBtn} onPress={() => setCourtModal(true)}><Text style={styles.actionBtnText}>팀 코트 세트 등록</Text></TouchableOpacity>
      <View style={styles.helpBox}>
        <Text style={styles.helpTitle}>💡 도움말</Text>
        <Text style={styles.helpItem}>
          팀 코트 세트는 자주 사용하는 코트 정보(코트명, 주소, 번호, 시간)를 미리 저장해두고, 일정 등록 시 한 번에 불러와 편리하게 사용할 수 있는 기능입니다.
        </Text>
      </View>
      <Modal visible={courtModal} transparent animationType="slide" onRequestClose={() => setCourtModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>팀 코트 세트 등록</Text>
              <TextInput placeholder="코트명" value={courtForm.courtName} onChangeText={v => setCourtForm(f => ({ ...f, courtName: v }))} style={[styles.inputPopup, {marginBottom: 12}]} />
              <TextInput placeholder="코트주소" value={courtForm.courtAddr} onChangeText={v => setCourtForm(f => ({ ...f, courtAddr: v }))} style={[styles.inputPopup, {height: 110, marginBottom: 12, textAlignVertical: 'top'}]} multiline maxLength={100} />
              <TextInput placeholder="코트번호" value={courtForm.courtNum} onChangeText={v => setCourtForm(f => ({ ...f, courtNum: v }))} style={[styles.inputPopup, {marginBottom: 12}]} />
              <TextInput placeholder="코트시간" value={courtForm.courtTime} onChangeText={v => setCourtForm(f => ({ ...f, courtTime: v }))} style={[styles.inputPopup, {marginBottom: 20}]} />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCourtSet}><Text style={styles.saveBtnText}>저장</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setCourtModal(false)}><Text style={{ color: '#888', marginTop: 8, textAlign: 'center' }}>닫기</Text></TouchableOpacity>
              <View style={[styles.helpBox, {marginTop: 20}]}>
                <Text style={styles.helpTitle}>💡 도움말</Text>
                <Text style={styles.helpItem}>
                  팀코트세트에서 등록하는 코트명, 코트주소는 자동으로 코트 리스트에 등록됩니다.{"\n"}
                  코트명이나 코트주소가 실제와 너무 다른경우 관리자에 의해 코트 리스트에서 삭제될 수 있습니다.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <TouchableOpacity style={styles.actionBtn} onPress={() => { setMemberModal(true); fetchMembers(false); }}><Text style={styles.actionBtnText}>회원 리스트 조회</Text></TouchableOpacity>
      <Modal visible={memberModal} transparent animationType="slide" onRequestClose={() => setMemberModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>회원 리스트</Text>
            {/* Sorting UI can be added here if needed */}
            <FlatList
              data={sortedMembers}
              keyExtractor={item => item.id}
              renderItem={renderMemberItem}
              style={{ maxHeight: 500 }}
              onEndReached={() => !loading && lastDoc && fetchMembers(true)}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loading ? <ActivityIndicator style={{marginVertical: 10}}/> : null}
            />
            <TouchableOpacity onPress={() => setMemberModal(false)}><Text style={{ color: '#888', marginTop: 8, textAlign: 'center' }}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRestHelp} transparent animationType="fade" onRequestClose={() => setShowRestHelp(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setShowRestHelp(false)}>
          <View style={styles.helpModal}>
            <Text style={styles.helpModalText}>잔여회원수 만큼 신규 회원가입을 받을 수 있습니다.</Text>
            <TouchableOpacity onPress={() => setShowRestHelp(false)} style={{ marginTop: 10 }}>
              <Ionicons name="close" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2563eb', marginBottom: 12, marginTop: 12 },
  infoBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#e5e7eb', elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoLabel: { width: 90, color: '#4b5563', fontSize: 15 },
  infoValueAlign: { flex: 1, color: '#111827', fontSize: 15, fontWeight: '600' },
  inputActive: { backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#111827', height: 40, flex: 1, fontWeight: '500' },
  saveBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  actionBtn: { backgroundColor: '#10b981', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 12, marginTop: 8 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  buyBtn: { backgroundColor: '#8b5cf6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  buyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%', maxHeight: '85%' },
  modalTitle: { fontWeight: 'bold', fontSize: 18, color: '#374151', marginBottom: 20, textAlign: 'center' },
  inputPopup: { backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', height: 48 },
  memberCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  memberStat: { color: '#374151', fontSize: 13, marginRight: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  helpModal: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#2563eb', padding: 20, margin: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  helpModalText: { color: '#1e3a8a', fontSize: 16, lineHeight: 24, textAlign: 'center', fontWeight: '500' },
  helpBox: { backgroundColor: '#eef2ff', borderRadius: 10, padding: 16, marginTop: -4, marginBottom: 12 },
  helpTitle: { color: '#4338ca', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  helpItem: { color: '#4338ca', fontSize: 14, lineHeight: 20 },
});

export default ClubManagerScreen;