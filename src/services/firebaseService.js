import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react';

const firebaseConfig = {
  apiKey: "AIzaSyBhyCFYDAoAMFSVp9fIakEgoQ2GEULmtDI",
  authDomain: "enjoytennis-5d9de.firebaseapp.com",
  projectId: "enjoytennis-5d9de",
  storageBucket: "enjoytennis-5d9de.appspot.com",
  messagingSenderId: "41176280311",
  appId: "1:41176280311:web:82985a0daaa338cfc537f2"
};

// Firebase 초기화 (중복 방지)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Firebase Auth 초기화 (Persistence 포함)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Firebase 인증 상태 관찰자 설정
export const onAuthStateChanged = (callback) => {
  return auth.onAuthStateChanged(callback);
};

// 로그인 (이메일/비밀번호)
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // Firestore에서 추가 정보 가져오기
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return {
      user,
      userData: userDoc.exists() ? userDoc.data() : null
    };
  } catch (error) {
    throw error;
  }
};

// 회원가입 (이메일/비밀번호)
export const signUpUser = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // Firestore에 추가 정보 저장 (uid를 문서ID로)
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      ...userData,
      createdAt: new Date().toISOString()
    });
    return user;
  } catch (error) {
    throw error;
  }
};

// 로그아웃 함수
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// 사용자 데이터 가져오기 함수
export async function getUserData(uid) {
  const userDocRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    return userDoc.data();
  }
  return null;
}

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

    // memberCnt_rest만 체크
    if (teamData.memberCnt_rest > 0) {
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