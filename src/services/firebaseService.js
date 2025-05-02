import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBhyCFYDAoAMFSVp9fIakEgoQ2GEULmtDI",
  authDomain: "enjoytennis-5d9de.firebaseapp.com",
  projectId: "enjoytennis-5d9de",
  storageBucket: "enjoytennis-5d9de.firebasestorage.app",
  messagingSenderId: "41176280311",
  appId: "1:41176280311:web:82985a0daaa338cfc537f2"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firebase Auth 초기화 with AsyncStorage
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Firebase 인증 상태 관찰자 설정
export const onAuthStateChanged = (callback) => {
  return auth.onAuthStateChanged(callback);
};

// 로그인 함수
export const signIn = async (userId, password) => {
  try {
    // 먼저 사용자 데이터를 가져와서 이메일 확인
    const userDoc = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userDoc);
    
    if (!userSnapshot.exists()) {
      throw new Error('user-not-found');
    }

    const userData = userSnapshot.data();
    
    // 비밀번호 확인
    if (userData.userPw !== password) {
      throw new Error('wrong-password');
    }

    // 로그인 성공
    return {
      user: {
        uid: userId,
        ...userData
      }
    };
  } catch (error) {
    console.error("로그인 오류:", error);
    throw error;
  }
};

// 로그아웃 함수
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("로그아웃 오류:", error);
    throw error;
  }
};

// 사용자 데이터 가져오기 함수
export const getUserData = async (userId) => {
  try {
    const userDoc = doc(db, 'users', userId);
    const snapshot = await getDoc(userDoc);
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error("데이터 가져오기 오류:", error);
    throw error;
  }
};

// 사용자 추가 함수
export const signUpUser = async (userId, userData) => {
  try {
    // Firestore에 사용자 정보 저장
    const userDoc = doc(db, 'users', userId);
    await setDoc(userDoc, {
      ...userData,
      createdAt: new Date().toISOString()
    });
    
    return userId;
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};

// 팀 데이터 가져오는 함수
export const getTeamData = async (teamId) => {
  try {
    const teamDoc = doc(db, 'teams', teamId);
    const teamSnapshot = await getDoc(teamDoc);
    if (teamSnapshot.exists()) {
      return teamSnapshot.data();
    } else {
      throw new Error('팀 데이터가 존재하지 않습니다.');
    }
  } catch (error) {
    console.error("팀 데이터 가져오기 오류:", error);
    throw error;
  }
};

// 팀 잔여 회원 수 차감 서비스
export const updateTeamMemberCount = async (teamId) => {
  try {
    const teamDoc = doc(db, 'teams', teamId);
    const teamSnapshot = await getDoc(teamDoc);
    const teamData = teamSnapshot.data();
  
    if (teamData.memberCnt_free > 0) {
      await updateDoc(teamDoc, {
        memberCnt_free: teamData.memberCnt_free - 1,
        memberCnt: teamData.memberCnt + 1,
      });
    } else if (teamData.memberCnt_rest > 0) {
      await updateDoc(teamDoc, {
        memberCnt_rest: teamData.memberCnt_rest - 1,
        memberCnt: teamData.memberCnt + 1,
      });
    } else {
      throw new Error('잔여 회원 수가 없습니다.');
    }
  } catch (error) {
    console.error("팀 회원 수 업데이트 오류:", error);
    throw error;
  }
};

// 소속팀 조회 함수
export const getTeams = async () => {
  try {
    const teamsCollection = collection(db, 'teams');
    const teamsSnapshot = await getDocs(teamsCollection);
    const teamsList = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      teamName: doc.data().teamName,
    }));
    return teamsList;
  } catch (error) {
    console.error("팀 목록 가져오기 오류:", error);
    throw error;
  }
};