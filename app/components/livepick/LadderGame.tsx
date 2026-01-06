import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Alert, LayoutChangeEvent } from 'react-native';
import colors from '../../../src/styles/colors'; // 경로가 다를 경우 프로젝트에 맞게 수정하세요

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- 고정 설정값 (수치 통일의 핵심) ---
const LADDERS = 5;
const HORIZONTAL_LINES = 5;
const LINE_HEIGHT = 45; // 가로선 사이의 간격 (높이)
const BALL_SIZE = 24;
const VERTICAL_LINE_TOP = 48; // 세로선이 시작되는 top 위치
const MIN_HORIZONTAL_BRIDGES = 6;

interface LadderGameProps {
  visible: boolean;
  onResult: (points: number) => void;
}

const REWARD_PROBABILITIES = [
  { points: 10, probability: 0.7 },
  { points: 50, probability: 0.2 },
  { points: 100, probability: 0.05 },
  { points: 200, probability: 0.03 },
  { points: 300, probability: 0.02 },
];

const getRewardByProbability = (): number => {
  const random = Math.random();
  let cumulative = 0;
  for (const reward of REWARD_PROBABILITIES) {
    cumulative += reward.probability;
    if (random <= cumulative) return reward.points;
  }
  return 10;
};

export default function LadderGame({ visible, onResult }: LadderGameProps) {
  const [result, setResult] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [selectedTopIndex, setSelectedTopIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0); // 실제 렌더링 너비 저장
  const [bottomRewards, setBottomRewards] = useState<(number | null)[]>(Array(LADDERS).fill(null)); // 하단 포인트 표시
  const [winningIndex, setWinningIndex] = useState<number | null>(null); // 당첨된 인덱스
  
  const ballPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;
  const ladderCoverOpacity = useRef(new Animated.Value(1)).current;

  // 사다리 구조 생성 로직 (기존 유지)
  const generateLadderStructure = () => {
    const structure = Array.from({ length: HORIZONTAL_LINES }, () => Array(LADDERS - 1).fill(false));
    let bridgeCount = 0;
    const allPositions: { r: number; c: number }[] = [];
    for (let r = 0; r < HORIZONTAL_LINES; r++) {
      for (let c = 0; c < LADDERS - 1; c++) allPositions.push({ r, c });
      }
    allPositions.sort(() => Math.random() - 0.5);

    for (const { r, c } of allPositions) {
      if (bridgeCount >= MIN_HORIZONTAL_BRIDGES) break;
      if (!structure[r][c] && !structure[r][c-1] && !structure[r][c+1]) {
        structure[r][c] = true;
        bridgeCount++;
      }
    }
    return structure;
  };
  
  const ladderStructure = useRef(generateLadderStructure()).current;

  useEffect(() => {
    if (!visible) {
      setResult(null);
      setAnimating(false);
      setSelectedTopIndex(null);
      setBottomRewards(Array(LADDERS).fill(null));
      setWinningIndex(null);
      ballOpacity.setValue(0);
      ladderCoverOpacity.setValue(1);
    }
  }, [visible]);

  // 컨테이너 너비가 측정되면 호출
  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const startAnimation = () => {
    if (selectedTopIndex === null) {
      Alert.alert('안내', '위에서 숫자를 먼저 선택해 주세요.');
      return;
    }

    setAnimating(true);
    const finalReward = getRewardByProbability();
    const columnWidth = containerWidth / LADDERS;
    
    // 1. 공 초기 위치 설정 (선택한 숫자 바로 아래)
    const startX = selectedTopIndex * columnWidth + (columnWidth / 2 - BALL_SIZE / 2);
    const startY = 10; // 상단 영역 안쪽
    ballPosition.setValue({ x: startX, y: startY });

    Animated.parallel([
      Animated.timing(ladderCoverOpacity, { toValue: 0, duration: 400, useNativeDriver: false }),
      Animated.timing(ballOpacity, { toValue: 1, duration: 300, useNativeDriver: false })
    ]).start();

    let currentLadder = selectedTopIndex;

    const animateStep = (levelIndex: number) => {
      // 모든 층을 내려왔을 때: 하단 보상 지점으로 이동
      if (levelIndex >= HORIZONTAL_LINES) {
        const finalY = VERTICAL_LINE_TOP + (HORIZONTAL_LINES * LINE_HEIGHT) + 15;
        Animated.timing(ballPosition, {
          toValue: { x: currentLadder * columnWidth + (columnWidth / 2 - BALL_SIZE / 2), y: finalY },
          duration: 400,
          useNativeDriver: false,
        }).start(() => {
        setResult(finalReward);
        setAnimating(false);
          setWinningIndex(currentLadder);
          
          // 하단 포인트 표시 설정: 당첨된 인덱스는 실제 포인트, 나머지는 당첨 포인트를 제외한 다른 포인트들
          const allRewards = [10, 50, 100, 200, 300];
          // 당첨된 포인트를 제외한 나머지 포인트들
          const remainingRewards = allRewards.filter(reward => reward !== finalReward);
          // 나머지 포인트들을 섞기
          const shuffled = [...remainingRewards].sort(() => Math.random() - 0.5);
          const newBottomRewards: (number | null)[] = Array(LADDERS).fill(null);
          
          // 당첨된 인덱스에 실제 포인트 설정
          newBottomRewards[currentLadder] = finalReward;
          
          // 나머지 인덱스에 당첨 포인트를 제외한 다른 포인트들을 랜덤 배치
          let rewardIndex = 0;
          for (let i = 0; i < LADDERS; i++) {
            if (newBottomRewards[i] === null) {
              // 나머지 포인트가 부족하면 반복 사용 (5개 도착점에 4개 포인트만 있으므로)
              newBottomRewards[i] = shuffled[rewardIndex % shuffled.length];
              rewardIndex++;
            }
          }
          
          setBottomRewards(newBottomRewards);
          setTimeout(() => onResult(finalReward), 800);
        });
        return;
      }

      // 현재 층의 Y좌표 (가로선이 있는 위치)
      const targetY = VERTICAL_LINE_TOP + (levelIndex * LINE_HEIGHT) + (LINE_HEIGHT / 2) - (BALL_SIZE / 2);
      const currentX = currentLadder * columnWidth + (columnWidth / 2 - BALL_SIZE / 2);
      
      // 세로 이동
      Animated.timing(ballPosition, {
        toValue: { x: currentX, y: targetY },
        duration: 400,
        useNativeDriver: false,
      }).start(() => {
        // 가로선 체크
        const hasRight = currentLadder < LADDERS - 1 && ladderStructure[levelIndex][currentLadder];
        const hasLeft = currentLadder > 0 && ladderStructure[levelIndex][currentLadder - 1];
        
        if (hasRight || hasLeft) {
          if (hasRight) currentLadder++;
          else currentLadder--;

          const nextX = currentLadder * columnWidth + (columnWidth / 2 - BALL_SIZE / 2);
          // 가로 이동
          Animated.timing(ballPosition, {
            toValue: { x: nextX, y: targetY },
            duration: 300,
            useNativeDriver: false,
          }).start(() => animateStep(levelIndex + 1));
        } else {
          // 가로선 없으면 바로 다음 층으로
          animateStep(levelIndex + 1);
        }
      });
    };

    setTimeout(() => animateStep(0), 600);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎯 사다리 게임</Text>
      
      {/* 상단 선택 */}
      <View style={styles.topChoicesContainer}>
        {Array.from({ length: LADDERS }).map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.topChoiceButton, selectedTopIndex === i && styles.topChoiceButtonSelected]}
            onPress={() => !animating && setSelectedTopIndex(i)}
          >
            <Text style={[styles.topChoiceText, selectedTopIndex === i && styles.topChoiceTextSelected]}>{i + 1}</Text>
          </TouchableOpacity>
        ))}
            </View>
            
      {/* 사다리 본체 */}
      <View style={styles.ladderContainer} onLayout={onLayout}>
        {Array.from({ length: LADDERS }).map((_, lIdx) => (
          <View key={lIdx} style={styles.ladderColumn}>
            <View style={styles.startPointEmpty} />
            <View style={styles.verticalLine} />
            {Array.from({ length: HORIZONTAL_LINES }).map((_, rIdx) => (
              <View key={rIdx} style={styles.lineContainer}>
                {ladderStructure[rIdx][lIdx - 1] && <View style={[styles.horizontalLine, styles.horizontalLineLeft]} />}
                  <View style={styles.verticalSegment} />
                {ladderStructure[rIdx][lIdx] && <View style={[styles.horizontalLine, styles.horizontalLineRight]} />}
                </View>
            ))}
            <View style={[
              styles.endPoint,
              result !== null && winningIndex === lIdx && styles.endPointWinning
            ]}>
              <Text style={[
                styles.endPointText,
                result !== null && winningIndex === lIdx && styles.endPointTextWinning
              ]}>
                {bottomRewards[lIdx] !== null ? `${bottomRewards[lIdx]}P` : '?'}
              </Text>
            </View>
          </View>
        ))}
        
        {/* 공 애니메이션 */}
        <Animated.View style={[styles.ball, { opacity: ballOpacity, transform: ballPosition.getTranslateTransform() }]}>
          <View style={styles.ballInner} />
        </Animated.View>

        {/* 가림막 */}
        <Animated.View pointerEvents="none" style={[styles.ladderCover, { opacity: ladderCoverOpacity }]}>
          <Text style={styles.coverMessageText}>행운의 숫자를 선택하세요!</Text>
        </Animated.View>
      </View>

      {!animating && result === null && (
        <TouchableOpacity style={styles.startButton} onPress={startAnimation}>
          <Text style={styles.startButtonText}>시작하기 🎯</Text>
        </TouchableOpacity>
      )}

      {result !== null && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultPoints}>{result}P 획득!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', width: '100%' },
  title: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 16 },
  topChoicesContainer: { flexDirection: 'row', width: '85%', marginBottom: 12 },
  topChoiceButton: { flex: 1, marginHorizontal: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', alignItems: 'center' },
  topChoiceButtonSelected: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  topChoiceText: { fontSize: 16, fontWeight: '600', color: '#666' },
  topChoiceTextSelected: { color: '#fff' },
  ladderContainer: { flexDirection: 'row', width: '85%', position: 'relative', minHeight: 320 },
  ladderColumn: { flex: 1, alignItems: 'center' },
  startPointEmpty: { height: 40, marginBottom: 8 },
  verticalLine: {
    width: 3, 
    backgroundColor: '#4A90E2', 
    height: HORIZONTAL_LINES * LINE_HEIGHT + 15, 
    position: 'absolute',
    top: VERTICAL_LINE_TOP, 
    zIndex: 0 
  },
  lineContainer: { width: '100%', height: LINE_HEIGHT, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  verticalSegment: { width: 3, height: LINE_HEIGHT, backgroundColor: '#4A90E2' },
  horizontalLine: { position: 'absolute', height: 3, backgroundColor: '#F5A623', width: '100%', zIndex: 1 },
  horizontalLineLeft: { right: '50%' },
  horizontalLineRight: { left: '50%' },
  endPoint: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 2, borderColor: '#ddd' },
  endPointWinning: { borderColor: '#F5A623', borderWidth: 3, backgroundColor: '#FFF9E6' },
  endPointText: { fontSize: 11, fontWeight: 'bold' },
  endPointTextWinning: { color: '#F5A623', fontSize: 12, fontWeight: 'bold' },
  ball: { position: 'absolute', width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_SIZE/2, backgroundColor: '#F5A623', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  ballInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  ladderCover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  coverMessageText: { fontSize: 15, color: '#888', fontWeight: '500' },
  startButton: { backgroundColor: '#F5A623', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, marginTop: 20 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  resultContainer: { marginTop: 20, padding: 15, backgroundColor: '#f0f9ff', borderRadius: 10, borderWidth: 1, borderColor: '#4A90E2' },
  resultPoints: { fontSize: 24, fontWeight: 'bold', color: '#4A90E2' }
});
