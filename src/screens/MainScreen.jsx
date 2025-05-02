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

const MainScreen = ({ navigation, route }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  let drawerRef = React.useRef(null);

  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        // route.params.userId를 통해 로그인 시 전달된 사용자 ID를 받아옴
        const userData = await getUserData(route.params?.userId);
        if (userData && userData.authGroup) {
          setIsAdmin(userData.authGroup.startsWith('ADM'));
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
          onPress: () => {
            // 로그인 정보 초기화 및 로그인 화면으로 이동
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
    const baseMenuItems = [
      { text: '내 정보', icon: 'user', path: 'Profile' },
    ];

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
              if (item.onPress) {
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
            <Text style={styles.title}>Enjoy Tennis</Text>
          </View>
          <ImageBackground
            source={require('../../assets/images/tennis-court.jpg')}
            style={styles.background}
            resizeMode="cover"
          >
            <Text style={styles.welcomeText}>Welcome to Enjoy Tennis</Text>
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