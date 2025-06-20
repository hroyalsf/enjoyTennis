import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput, ScrollView, StyleSheet, Platform, Modal, FlatList } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc, collection, setDoc, getDocs, updateDoc, increment } from 'firebase/firestore';
import { getUserData } from '../services/firebaseService';
import styles from '../style/gameManagerStyle';

const db = getFirestore();

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 16,
    height: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#222',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 4,
    textAlign: 'center',
  },
  inputAndroid: {
    fontSize: 16,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#222',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 4,
    textAlign: 'center',
  },
  iconContainer: {
    top: 10,
    right: 12,
  },
  placeholder: {
    color: '#aaa',
    textAlign: 'center',
  },
};

const GameManagerScreen = ({ navigation, route }) => {
  const { userId } = route.params || {};
  // 오늘 날짜를 KST 기준으로 셋팅
  const getTodayLocal = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  const [date, setDate] = useState(getTodayLocal());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [userTeam, setUserTeam] = useState('');
  const [playPlan, setPlayPlan] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [gameType, setGameType] = useState('single'); // 'single' or 'double'
  const [games, setGames] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [isResultSaved, setIsResultSaved] = useState(false);
  const [authGroup, setAuthGroup] = useState('');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statArr, setStatArr] = useState([]);
  const [isUpdateStatsDisabled, setIsUpdateStatsDisabled] = useState(false);

  // 1. 유저팀 정보 및 authGroup 가져오기
  useEffect(() => {
    const fetchUserTeam = async () => {
      if (!userId) return;
      const userData = await getUserData(userId);
      if (userData?.userTeam) setUserTeam(userData.userTeam);
      if (userData?.authGroup) setAuthGroup(userData.authGroup);
    };
    fetchUserTeam();
  }, [userId]);

  // 2. playPlan 정보 가져오기
  useEffect(() => {
    const fetchPlayPlan = async () => {
      if (!userTeam || !date) return;
      const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };
      const dateText = formatDate(date);
      const dateId = dateText.replace(/-/g, '');
      const planDoc = await getDoc(doc(db, 'teams', userTeam, 'playPlan', dateId));
      if (planDoc.exists()) {
        setPlayPlan(planDoc.data());
        setAttendees(planDoc.data().members || []);
        // playResult 조회
        const playResultCol = collection(db, 'teams', userTeam, 'playPlan', dateId, 'playResult');
        const playResultSnap = await getDocs(playResultCol);
        if (!playResultSnap.empty) {
          // playResult가 있으면 games state에 반영
          const loadedGames = [];
          playResultSnap.forEach(docSnap => {
            const d = docSnap.data();
            loadedGames.push({
              type: d.type,
              players: d.type === 'double'
                ? [
                    { userName: d.team1name_1, userId: d.team1uid_1 },
                    { userName: d.team1name_2, userId: d.team1uid_2 },
                    { userName: d.team2name_1, userId: d.team2uid_1 },
                    { userName: d.team2name_2, userId: d.team2uid_2 }
                  ]
                : [
                    { userName: d.team1name_1, userId: d.team1uid_1 },
                    { userName: d.team2name_1, userId: d.team2uid_1 }
                  ],
              result: [d.team1score, d.team2score],
            });
          });
          setGames(loadedGames);
          setIsResultSaved(true);
        } else {
          setGames([]);
          setIsResultSaved(false);
        }
      } else {
        setPlayPlan(null);
        setAttendees([]);
        setGames([]);
        setIsResultSaved(false);
      }
      setGameStarted(false);
    };
    fetchPlayPlan();
  }, [userTeam, date]);

  // 3. 날짜 선택 핸들러
  const handleConfirmDate = (selectedDate) => {
    setDatePickerVisibility(false);
    setDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()));
  };

  // 4. 단식/복식 라디오버튼
  const handleGameType = (type) => {
    if (type === 'double' && attendees.length < 4) {
      Alert.alert('복식은 참석인원이 4명 이상일 때만 선택할 수 있습니다.');
      return;
    }
    setGameType(type);
  };

  // 5. 대진표 row 추가
  const handleAddGame = () => {
    if (gameType === 'single' && attendees.length < 2) {
      Alert.alert('단식은 참석인원이 2명 이상이어야 합니다.');
      return;
    }
    if (gameType === 'double' && attendees.length < 4) {
      Alert.alert('복식은 참석인원이 4명 이상이어야 합니다.');
      return;
    }
    setGames([
      ...games,
      {
        type: gameType,
        players: gameType === 'single'
          ? [null, null]
          : [null, null, null, null],
        result: ['', ''],
      },
    ]);
  };

  // 6. 대진표 row 삭제
  const handleDeleteGame = (idx) => {
    setGames(games.filter((_, i) => i !== idx));
  };

  // 7. 참석인원 중복 선택 방지
  const getAvailableAttendees = (rowIdx, playerIdx) => {
    const selectedInRow = games[rowIdx]?.players
      .filter((_, j) => j !== playerIdx)
      .filter(Boolean)
      .map(p => p?.userId);
    return attendees.filter(a => !selectedInRow.includes(a.userId));
  };

  // 8. 대진표 자동생성
  const handleAutoGenerate = () => {
    if (games.length > 0) {
      Alert.alert(
        '게임 자동생성',
        '현재 설정된 게임은 초기화하고 새로 생성합니다. 진행하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: 'OK',
            onPress: () => generateGames(),
          },
        ]
      );
    } else {
      generateGames();
    }
  };

  // 실제 게임 생성 로직 분리
  const generateGames = () => {
    if (gameType === 'single') {
      // ability 차이 기준으로 2인 조합 생성
      let pairs = [];
      for (let i = 0; i < attendees.length; i++) {
        for (let j = i + 1; j < attendees.length; j++) {
          const a1 = attendees[i];
          const a2 = attendees[j];
          const diff = Math.abs((a1.ability || 0) - (a2.ability || 0));
          pairs.push({
            type: 'single',
            players: [a1, a2],
            result: ['', ''],
            diff,
          });
        }
      }
      pairs.sort((a, b) => a.diff - b.diff);
      setGames(pairs.slice(0, 10));
    } else {
      // 복식: 4명씩 가능한 모든 조합, 팀 ability 합 차이 기준
      let games = [];
      const n = attendees.length;
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          for (let c = b + 1; c < n; c++) {
            for (let d = c + 1; d < n; d++) {
              const group = [attendees[a], attendees[b], attendees[c], attendees[d]];
              // 4명을 2:2로 나누는 모든 경우 (3가지)
              const splits = [
                [[0, 1], [2, 3]],
                [[0, 2], [1, 3]],
                [[0, 3], [1, 2]],
              ];
              splits.forEach(([team1Idx, team2Idx]) => {
                const team1 = [group[team1Idx[0]], group[team1Idx[1]]];
                const team2 = [group[team2Idx[0]], group[team2Idx[1]]];
                const ability1 = (team1[0].ability || 0) + (team1[1].ability || 0);
                const ability2 = (team2[0].ability || 0) + (team2[1].ability || 0);
                const diff = Math.abs(ability1 - ability2);
                games.push({
                  type: 'double',
                  players: [team1[0], team1[1], team2[0], team2[1]],
                  result: ['', ''],
                  diff,
                });
              });
            }
          }
        }
      }
      games.sort((a, b) => a.diff - b.diff);
      setGames(games.slice(0, 10));
    }
  };

  // 9. 게임시작
  const handleStartGame = () => {
    setGameStarted(true);
  };

  // 10. 플레이어 선택 핸들러
  const handleSelectPlayer = (rowIdx, playerIdx, userId) => {
    const selectedAttendee = attendees.find(a => a.userId === userId) || null;
    const updatedGames = games.map((g, i) =>
      i === rowIdx
        ? { ...g, players: g.players.map((p, j) => (j === playerIdx ? selectedAttendee : p)) }
        : g
    );
    setGames(updatedGames);
  };

  // 11. 결과 입력 핸들러
  const handleResultChange = (rowIdx, resultIdx, value) => {
    const updatedGames = games.map((g, i) =>
      i === rowIdx
        ? { ...g, result: g.result.map((r, j) => (j === resultIdx ? value : r)) }
        : g
    );
    setGames(updatedGames);
  };

  // 날짜 포맷
  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const dateText = formatDate(date);
  const dateId = dateText.replace(/-/g, '');

  const handleSaveResult = async () => {
    if (!userTeam || !date) return;
    // 점수 입력 체크
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      if (!game.result[0] || !game.result[1]) {
        Alert.alert('입력 오류', '모든 게임의 점수를 입력해 주세요.');
        return;
      }
      // 참석인원 선택 체크
      if (game.type === 'single') {
        if (!game.players[0]?.userId || !game.players[1]?.userId) {
          Alert.alert('입력 오류', '모든 게임의 참석인원을 선택해 주세요.');
          return;
        }
      } else if (game.type === 'double') {
        if (
          !game.players[0]?.userId ||
          !game.players[1]?.userId ||
          !game.players[2]?.userId ||
          !game.players[3]?.userId
        ) {
          Alert.alert('입력 오류', '모든 게임의 참석인원을 선택해 주세요.');
          return;
        }
      }
    }
    const playResultCol = collection(db, 'teams', userTeam, 'playPlan', dateId, 'playResult');

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const isDouble = game.type === 'double';

      await setDoc(doc(playResultCol, `game_${i}_${Date.now()}`), {
        team1uid_1: game.players[0]?.userId || '',
        team1uid_2: isDouble ? (game.players[1]?.userId || '') : '',
        team1name_1: game.players[0]?.userName || '',
        team1name_2: isDouble ? (game.players[1]?.userName || '') : '',
        team2uid_1: isDouble ? (game.players[2]?.userId || '') : (game.players[1]?.userId || ''),
        team2uid_2: isDouble ? (game.players[3]?.userId || '') : '',
        team2name_1: isDouble ? (game.players[2]?.userName || '') : (game.players[1]?.userName || ''),
        team2name_2: isDouble ? (game.players[3]?.userName || '') : '',
        team1score: game.result[0] || '',
        team2score: game.result[1] || '',
        type: game.type,
        createdAt: new Date(),
      });
    }
    // === 참가자 attendCnt +1 ===
    // 모든 게임의 모든 참가자 userId를 중복 없이 추출
    const allUserIds = new Set();
    games.forEach(game => {
      (game.players || []).forEach(p => {
        if (p?.userId) allUserIds.add(p.userId);
      });
    });
    // users 컬렉션에서 각 userId의 attendCnt를 누적으로 +1
    for (const userId of allUserIds) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { attendCnt: increment(1), ability: increment(10) });
    }
    setIsResultSaved(true);

    // 통계 계산 함수
    const showStats = () => {
      const stats = {};
      attendees.forEach(a => {
        stats[a.userId] = {
          userId: a.userId,
          name: a.userName,
          win: 0,
          draw: 0,
          lose: 0,
          point: 0,
          scoreDiff: 0,
        };
      });

      games.forEach(game => {
        const s1 = parseInt(game.result[0], 10);
        const s2 = parseInt(game.result[1], 10);

        let team1 = [], team2 = [];
        if (game.type === 'single') {
          team1 = [game.players[0]];
          team2 = [game.players[1]];
        } else {
          team1 = [game.players[0], game.players[1]];
          team2 = [game.players[2], game.players[3]];
        }

        let result1, result2;
        if (s1 > s2) {
          result1 = 'win'; result2 = 'lose';
        } else if (s1 < s2) {
          result1 = 'lose'; result2 = 'win';
        } else {
          result1 = result2 = 'draw';
        }

        team1.forEach(p => {
          if (!p?.userId) return;
          stats[p.userId][result1]++;
          stats[p.userId].point += result1 === 'win' ? 2 : result1 === 'draw' ? 1 : 0;
          stats[p.userId].scoreDiff += s1 - s2;
        });
        team2.forEach(p => {
          if (!p?.userId) return;
          stats[p.userId][result2]++;
          stats[p.userId].point += result2 === 'win' ? 2 : result2 === 'draw' ? 1 : 0;
          stats[p.userId].scoreDiff += s2 - s1;
        });
      });

      const statArr = Object.values(stats);
      statArr.sort((a, b) => b.point - a.point || b.scoreDiff - a.scoreDiff);
      statArr.forEach((s, i) => { s.rank = i + 1; });

      setStatArr(statArr);
      setShowStatsModal(true);
    };

    Alert.alert('저장 완료', '게임 결과가 저장되었습니다.', [
      { text: 'OK', onPress: showStats }
    ]);
  };

  const handleUpdateStats = async () => {
    if (isUpdateStatsDisabled) return;
    for (const stat of statArr) {
      if (!stat.userId) continue;
      const userRef = doc(db, 'users', stat.userId);
      await updateDoc(userRef, {
        winCnt: increment(stat.win),
        drawCnt: increment(stat.draw),
        lossCnt: increment(stat.lose),
        ability: increment(stat.win * 30 + stat.draw * 20 + stat.lose * 10),
      });
    }
    setIsUpdateStatsDisabled(true);
    Alert.alert('업데이트 완료', '참석자별 승/무/패가 누적으로 저장되었습니다.');
  };

  return (
    <ScrollView style={styles.container}>
      {/* 날짜 선택 */}
      <View style={styles.row}>
        <Text style={styles.label}>날짜</Text>
        <TouchableOpacity onPress={() => setDatePickerVisibility(true)} style={styles.dateBox}>
          <Text style={styles.dateText}>{dateText}</Text>
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
          date={date}
          display={Platform.OS === 'android' ? 'calendar' : undefined}
        />
      </View>

      {/* playPlan 조회 결과 */}
      {playPlan ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>코트: {playPlan.courtName}</Text>
          <Text style={styles.infoText}>코트 번호: {playPlan.courtNum}</Text>
          <Text style={styles.infoText}>시간: {playPlan.courtTime}</Text>
          <Text style={styles.infoText}>
            참석인원: {attendees.length > 0 ? attendees.map(a => a.userName).join(', ') : '없음'}
          </Text>
        </View>
      ) : (
        <Text style={{ marginVertical: 16, color: '#888' }}>해당 날짜에 등록된 일정이 없습니다.</Text>
      )}

      {/* 단식/복식 라디오버튼 */}
      {authGroup.startsWith('ADM') && (
        <View style={styles.row}>
          <TouchableOpacity
            style={[
              styles.radio,
              gameType === 'single' && styles.radioSelected,
              isResultSaved && styles.readonlyBtn
            ]}
            onPress={() => handleGameType('single')}
            disabled={isResultSaved}
          >
            <Text style={[
              styles.radioText,
              gameType === 'single' && styles.radioTextSelected,
              isResultSaved && styles.readonlyText
            ]}>단식</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.radio,
              gameType === 'double' && styles.radioSelected,
              attendees.length < 4 && styles.radioDisabled,
            ]}
            onPress={() => handleGameType('double')}
            disabled={attendees.length < 4 || isResultSaved}
          >
            <Text style={[
              styles.radioText,
              gameType === 'double' && styles.radioTextSelected
            ]}>복식</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAutoGenerate} disabled={isResultSaved}>
            <Text style={styles.actionBtnText}>게임자동생성</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAddGame} disabled={isResultSaved}>
            <Text style={styles.actionBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 대진표 그리드 */}
      {games.map((game, rowIdx) => (
        <View key={rowIdx} style={styles.gameGridTable}>
          {/* 1행 */}
          <View style={styles.gameGridRow}>
            {/* 1열: 삭제 버튼 */}
            <View style={styles.gameGridCellDelete}>
              <TouchableOpacity
                onPress={() => handleDeleteGame(rowIdx)}
                style={[
                  styles.gameGridDeleteBtn,
                  isResultSaved && styles.readonlyDeleteBtn
                ]}
                disabled={isResultSaved}
              >
                <Ionicons name="close-circle" style={[
                  styles.gameGridDeleteIcon,
                  isResultSaved && styles.readonlyText
                ]} />
              </TouchableOpacity>
            </View>
            {/* 2열: 참석자 선택 */}
            <View style={styles.gameGridCellWide}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <RNPickerSelect
                  onValueChange={userId => handleSelectPlayer(rowIdx, 0, userId)}
                  items={getAvailableAttendees(rowIdx, 0).map(a => ({
                    label: a.userName,
                    value: a.userId
                  }))}
                  value={game.players[0]?.userId || ''}
                  placeholder={{ label: '선택', value: '' }}
                  style={{
                    ...pickerSelectStyles,
                    inputAndroid: {
                      ...pickerSelectStyles.inputAndroid,
                      zIndex: 10 - 0,
                      position: 'relative',
                      opacity: isResultSaved ? 0.5 : 1,
                      backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                      color: isResultSaved ? '#999' : '#222',
                    },
                    inputIOS: {
                      ...pickerSelectStyles.inputIOS,
                      zIndex: 10 - 0,
                      position: 'relative',
                      opacity: isResultSaved ? 0.5 : 1,
                      backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                      color: isResultSaved ? '#999' : '#222',
                    },
                    placeholder: {
                      color: isResultSaved ? '#bbb' : '#222',
                      textAlign: 'center',
                    }
                  }}
                  useNativeAndroidPickerStyle={false}
                  disabled={isResultSaved}
                />
                {game.type === 'double' && (
                  <RNPickerSelect
                    onValueChange={userId => handleSelectPlayer(rowIdx, 1, userId)}
                    items={getAvailableAttendees(rowIdx, 1).map(a => ({
                      label: a.userName,
                      value: a.userId
                    }))}
                    value={game.players[1]?.userId || ''}
                    placeholder={{ label: '선택', value: '' }}
                    style={{
                      ...pickerSelectStyles,
                      inputAndroid: {
                        ...pickerSelectStyles.inputAndroid,
                        zIndex: 10 - 1,
                        position: 'relative',
                        opacity: isResultSaved ? 0.5 : 1,
                        backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                        color: isResultSaved ? '#999' : '#222',
                      },
                      inputIOS: {
                        ...pickerSelectStyles.inputIOS,
                        zIndex: 10 - 1,
                        position: 'relative',
                        opacity: isResultSaved ? 0.5 : 1,
                        backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                        color: isResultSaved ? '#999' : '#222',
                      },
                      placeholder: {
                        color: isResultSaved ? '#bbb' : '#222',
                        textAlign: 'center',
                      }
                    }}
                    useNativeAndroidPickerStyle={false}
                    disabled={isResultSaved}
                  />
                )}
              </View>
            </View>
            {/* 3열: 참석자 선택 */}
            <View style={styles.gameGridCellWide}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <RNPickerSelect
                  onValueChange={userId => handleSelectPlayer(rowIdx, game.type === 'single' ? 1 : 2, userId)}
                  items={getAvailableAttendees(rowIdx, game.type === 'single' ? 1 : 2).map(a => ({
                    label: a.userName,
                    value: a.userId
                  }))}
                  value={game.players[game.type === 'single' ? 1 : 2]?.userId || ''}
                  placeholder={{ label: '선택', value: '' }}
                  style={{
                    ...pickerSelectStyles,
                    inputAndroid: {
                      ...pickerSelectStyles.inputAndroid,
                      zIndex: 10 - (game.type === 'single' ? 1 : 2),
                      position: 'relative',
                      opacity: isResultSaved ? 0.5 : 1,
                      backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                      color: isResultSaved ? '#999' : '#222',
                    },
                    inputIOS: {
                      ...pickerSelectStyles.inputIOS,
                      zIndex: 10 - (game.type === 'single' ? 1 : 2),
                      position: 'relative',
                      opacity: isResultSaved ? 0.5 : 1,
                      backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                      color: isResultSaved ? '#999' : '#222',
                    },
                    placeholder: {
                      color: isResultSaved ? '#bbb' : '#222',
                      textAlign: 'center',
                    }
                  }}
                  useNativeAndroidPickerStyle={false}
                  disabled={isResultSaved}
                />
                {game.type === 'double' && (
                  <RNPickerSelect
                    onValueChange={userId => handleSelectPlayer(rowIdx, 3, userId)}
                    items={getAvailableAttendees(rowIdx, 3).map(a => ({
                      label: a.userName,
                      value: a.userId
                    }))}
                    value={game.players[3]?.userId || ''}
                    placeholder={{ label: '선택', value: '' }}
                    style={{
                      ...pickerSelectStyles,
                      inputAndroid: {
                        ...pickerSelectStyles.inputAndroid,
                        zIndex: 10 - 3,
                        position: 'relative',
                        opacity: isResultSaved ? 0.5 : 1,
                        backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                        color: isResultSaved ? '#999' : '#222',
                      },
                      inputIOS: {
                        ...pickerSelectStyles.inputIOS,
                        zIndex: 10 - 3,
                        position: 'relative',
                        opacity: isResultSaved ? 0.5 : 1,
                        backgroundColor: isResultSaved ? '#f5f5f5' : '#fff',
                        color: isResultSaved ? '#999' : '#222',
                      },
                      placeholder: {
                        color: isResultSaved ? '#bbb' : '#222',
                        textAlign: 'center',
                      }
                    }}
                    useNativeAndroidPickerStyle={false}
                    disabled={isResultSaved}
                  />
                )}
              </View>
            </View>
          </View>
          {/* 2행 */}
          <View style={[styles.gameGridRow, styles.gameGridRowBottom]}>
            {/* 1열: "점수입력" */}
            <View style={styles.gameGridCellDelete}>
              <Text style={styles.scoreLabel}>점수입력</Text>
            </View>
            {/* 2열: 점수 입력 */}
            <View style={styles.gameGridCellWide}>
              <TextInput
                style={[
                  styles.gameGridInput,
                  isResultSaved && styles.readonlyInput
                ]}
                value={game.result[0]}
                onChangeText={v => handleResultChange(rowIdx, 0, v)}
                keyboardType="numeric"
                placeholder="점수"
                editable={!isResultSaved}
              />
            </View>
            {/* 3열: 점수 입력 */}
            <View style={styles.gameGridCellWide}>
              <TextInput
                style={[
                  styles.gameGridInput,
                  isResultSaved && styles.readonlyInput
                ]}
                value={game.result[1]}
                onChangeText={v => handleResultChange(rowIdx, 1, v)}
                keyboardType="numeric"
                placeholder="점수"
                editable={!isResultSaved}
              />
            </View>
          </View>
        </View>
      ))}

      {/* 게임시작 버튼 */}
      {authGroup.startsWith('ADM') && (
        <TouchableOpacity
          style={[
            styles.startBtn,
            isResultSaved && styles.readonlyBtn
          ]}
          onPress={handleSaveResult}
          disabled={isResultSaved}
        >
          <Text style={[
            styles.startBtnText,
            isResultSaved && styles.readonlyText
          ]}>결과저장</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showStatsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 18,
            minWidth: 320,
            maxWidth: '90%',
            flex: 0,
            alignItems: 'stretch',
          }}>
            <Text style={{
              fontWeight: 'bold',
              fontSize: 20,
              marginBottom: 12,
              textAlign: 'center'
            }}>경기 통계</Text>
            {/* 표 헤더 */}
            <View style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderColor: '#d1d5db',
              paddingBottom: 6
            }}>
              {['순위', '이름', '승점', '승', '무', '패', '득실'].map((h, idx) => (
                <Text key={h} style={{
                  flex: idx === 1 ? 2 : 1,
                  fontWeight: 'bold',
                  fontSize: 15,
                  textAlign: 'center',
                  color: '#2563eb'
                }}>{h}</Text>
              ))}
            </View>
            {/* 표 데이터 */}
            <FlatList
              data={statArr}
              keyExtractor={item => item.rank + item.name}
              renderItem={({ item }) => (
                <View style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderColor: '#f0f0f0',
                  paddingVertical: 6,
                  backgroundColor: item.rank % 2 === 0 ? '#f8fafc' : '#fff'
                }}>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>{item.rank}</Text>
                  <Text style={{ flex: 2, textAlign: 'center', fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>{item.point}</Text>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>{item.win}</Text>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>{item.draw}</Text>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>{item.lose}</Text>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>{item.scoreDiff}</Text>
                </View>
              )}
              style={{ marginBottom: 0, maxHeight: 300 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 18,
                  marginRight: 10,
                  alignSelf: 'center',
                  opacity: isUpdateStatsDisabled ? 0.5 : 1,
                }}
                onPress={handleUpdateStats}
                disabled={isUpdateStatsDisabled}
              >
                <Text style={{
                  color: '#fff',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: 15
                }}>점수업데이트</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#2563eb',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 18,
                  alignSelf: 'center',
                }}
                onPress={() => setShowStatsModal(false)}
              >
                <Text style={{
                  color: '#fff',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: 15
                }}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default GameManagerScreen;
