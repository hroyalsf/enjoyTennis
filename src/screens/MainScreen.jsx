import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-elements';
import { DrawerLayout } from 'react-native-gesture-handler';
import { getUserData } from '../services/firebaseService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MainScreen = ({ navigation, route }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authName, setAuthName] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  let drawerRef = React.useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!route.params?.userId) return;
      const userData = await getUserData(route.params.userId);
      setUser(userData);
    };
    fetchUser();
  }, [route.params?.userId]);

  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        // route.params.userId를 통해 로그인 시 전달된 사용자 ID를 받아옴
        const userData = await getUserData(route.params?.userId);
        if (userData && userData.authGroup) {
          setIsAdmin(userData.authGroup.startsWith('ADM'));
          let authNameValue = '';
          if (typeof userData.authGroup === 'string' && userData.authGroup.trim() !== '') {
            const authDoc = await getDoc(doc(db, 'authGroup', userData.authGroup));
            if (authDoc.exists()) {
              authNameValue = authDoc.data().authName;
            }
          }
          setAuthName(authNameValue);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    checkUserAuth();
  }, [route.params?.userId]);

  const handleLogout = () => {
    Alert.alert(
      "로그아웃",
      "로그아웃 하시겠습니까?",
      [
        {
          text: "취소",
          style: "cancel"
        },
        {
          text: "확인",
          onPress: async () => {
            // 로그인 정보 초기화 및 로그인 화면으로 이동
            await AsyncStorage.removeItem('autoLogin');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      ]
    );
  };

  const getMenuItems = () => {
    // userStat이 100이면 로그아웃만 보이게
    if (user && user.userStat === 100) {
      return [
        {
          text: '로그아웃',
          icon: 'log-out',
          onPress: handleLogout
        }
      ];
    }

    const baseMenuItems = [
      { text: '내 정보', icon: 'user', path: 'Profile' },
    ];

    if (user && (user.authGroup === 'ADM00' || user.authGroup === 'ADM01')) {
      baseMenuItems.push({
        text: '클럽 관리',
        icon: 'settings',
        path: 'ClubManager',
        params: { userId: route.params?.userId, userTeam: user.userTeam }
      });
    }

    // 관리자인 경우에만 일정 등록 메뉴 추가
    if (isAdmin) {
      baseMenuItems.push({ 
        text: '일정 등록', 
        icon: 'plus-circle', 
        path: 'ScheduleRegister',
        params: { userId: route.params?.userId }
      });
    }

    // 일정 관리 메뉴 추가
    baseMenuItems.push({ 
      text: '일정 관리', 
      icon: 'calendar', 
      path: 'ScheduleList',
      params: { userId: route.params?.userId }
    });

    // === 게임관리 메뉴 추가 ===
    baseMenuItems.push({
      text: '게임 관리',
      icon: 'grid', // 원하는 아이콘(feather 기준)
      path: 'GameManager',
      params: { userId: route.params?.userId }
    });

    // 로그아웃 메뉴 추가
    baseMenuItems.push({
      text: '로그아웃',
      icon: 'log-out',
      onPress: handleLogout
    });

    return baseMenuItems;
  };

  const renderDrawerContent = () => (
    <View style={styles.drawer}>
      <ScrollView>
        {getMenuItems().map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => {
              drawerRef.current?.closeDrawer();
              if (item.text === '내 정보') {
                navigation.navigate('Profile', { userId: route.params?.userId });
              } else if (item.onPress) {
                item.onPress();
              } else {
                navigation.navigate(item.path, item.params);
              }
            }}
          >
            <Icon name={item.icon} type="feather" size={24} color="#333" />
            <Text style={styles.menuText}>{item.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DrawerLayout
        ref={drawerRef}
        drawerWidth={250}
        drawerPosition={DrawerLayout.positions.Left}
        renderNavigationView={renderDrawerContent}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => drawerRef.current?.openDrawer()}
              style={styles.menuButton}
            >
              <Icon name="menu" type="feather" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>테니스클럽</Text>
          </View>
          <ImageBackground
            source={require('../../assets/images/tennis-court.jpg')}
            style={styles.background}
            resizeMode="cover"
          >
            <Text style={styles.welcomeText}>Welcome to 테니스클럽</Text>
          </ImageBackground>
        </View>
      </DrawerLayout>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
    lineHeight: 24,
    paddingTop: 2,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    borderRadius: 8,
  },
  drawer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#333',
  },
});

export default MainScreen; 