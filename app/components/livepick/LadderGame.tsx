import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Alert } from 'react-native';

const START_OFFSET_Y = 30; // 시작점 오프셋 (높이 줄임)
import colors from '../../../src/styles/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LadderGameProps {
  visible: boolean;
  onResult: (points: number) => void; // 결과 콜백 (보상 포인트)
}

// 사다리 게임 보상 확률 테이블 (명령문 기준)
// 10P(70%), 50P(20%), 100P(5%), 200P(3%), 300P(2%)
const REWARD_PROBABILITIES = [
  { points: 10, probability: 0.7 },
  { points: 50, probability: 0.2 },
  { points: 100, probability: 0.05 },
  { points: 200, probability: 0.03 },
  { points: 300, probability: 0.02 },
];

// 확률 기반 보상 결정 함수
const getRewardByProbability = (): number => {
  const random = Math.random();
  let cumulative = 0;
  
  for (const reward of REWARD_PROBABILITIES) {
    cumulative += reward.probability;
    if (random <= cumulative) {
      return reward.points;
    }
  }
  
  // 기본값 (발생하지 않아야 함)
  return 10;
};

// 사다리 개수와 가로선 개수 (5개 보상에 맞춰 5개 사다리)
const LADDERS = 5; // 5개의 사다리 (각 보상 하나씩)
const HORIZONTAL_LINES = 5; // 5개의 가로선 (한 화면에 맞게 줄임)
const MIN_HORIZONTAL_BRIDGES = 6; // 최소 가로선(노란색) 개수

export default function LadderGame({ visible, onResult }: LadderGameProps) {
  const [result, setResult] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [selectedLadder, setSelectedLadder] = useState<number>(0); // 선택된 사다리 인덱스
  const [selectedTopIndex, setSelectedTopIndex] = useState<number | null>(null); // 상단 숫자 선택 인덱스
  
  // 사다리 경로 애니메이션
  const ballPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ballOpacity = useRef(new Animated.Value(0)).current;
  const ladderCoverOpacity = useRef(new Animated.Value(1)).current; // 사다리 가림막 투명도
  
  // 사다리 구조 (가로선 위치를 미리 결정)
  // 가로선을 최소 6개 이상 그리고, 인접한 가로선이 겹치지 않게 제한
  const generateLadderStructure = (): boolean[][] => {
    const structure: boolean[][] = Array.from({ length: HORIZONTAL_LINES }, () => 
      Array.from({ length: LADDERS - 1 }, () => false)
    );
    
    // 가로선을 최소 6개 이상 배치
    let bridgeCount = 0;
    const minBridges = MIN_HORIZONTAL_BRIDGES;
    
    // 모든 가능한 위치 수집
    const allPositions: Array<{ lineIndex: number; position: number }> = [];
    for (let lineIndex = 0; lineIndex < HORIZONTAL_LINES; lineIndex++) {
      for (let position = 0; position < LADDERS - 1; position++) {
        allPositions.push({ lineIndex, position });
      }
    }
    
    // 위치를 랜덤하게 섞기
    for (let i = allPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }
    
    // 최소 개수만큼 가로선 배치 (인접한 가로선이 겹치지 않도록)
    for (const { lineIndex, position } of allPositions) {
      if (bridgeCount >= minBridges) break;
      
      // 같은 레벨에서 인접한 가로선이 있는지 확인
      const hasAdjacentLeft = position > 0 && structure[lineIndex][position - 1];
      const hasAdjacentRight = position < LADDERS - 2 && structure[lineIndex][position + 1];
      
      // 인접한 가로선이 없으면 배치 가능
      if (!hasAdjacentLeft && !hasAdjacentRight) {
        structure[lineIndex][position] = true;
        bridgeCount++;
      }
    }
    
    // 최소 개수에 못 미치면 추가 배치 (조건 완화)
    if (bridgeCount < minBridges) {
      for (const { lineIndex, position } of allPositions) {
        if (bridgeCount >= minBridges) break;
        if (!structure[lineIndex][position]) {
          structure[lineIndex][position] = true;
          bridgeCount++;
        }
      }
    }
    
    return structure;
  };
  
  const ladderStructure = useRef<boolean[][]>(generateLadderStructure()).current;

  useEffect(() => {
    if (!visible) {
      // 모달이 닫히면 상태 초기화
      setResult(null);
      setAnimating(false);
      setSelectedLadder(0);
       setSelectedTopIndex(null);
      ballPosition.setValue({ x: 0, y: START_OFFSET_Y });
      ballOpacity.setValue(0);
       ladderCoverOpacity.setValue(1); // 다시 가려놓기
    }
  }, [visible]);

  const startAnimation = () => {
    // 숫자 선택 안 했으면 안내
    if (selectedTopIndex === null) {
      Alert.alert('안내', '위에서 1~5 중 하나의 숫자를 먼저 선택해 주세요.');
      return;
    }

    setAnimating(true);
    setResult(null);
    
    // 확률 기반 보상 결정
    const finalReward = getRewardByProbability();
    
    // 사용자가 선택한 상단 위치에서 시작
    const startLadder = selectedTopIndex;
    setSelectedLadder(startLadder);
    
    // 공 위치 계산을 위한 상수들
    const ballSize = 24;
    // ladderContainer는 width: '80%'이고 중앙 정렬됨
    // 실제 너비를 약간 줄여서 정확한 위치 맞춤 (75px 보정)
    const ladderAreaWidth = SCREEN_WIDTH * 0.8 - 75; // ladderContainer의 너비 (80%에서 75px 빼기)
    const columnWidth = ladderAreaWidth / LADDERS; // 각 컬럼의 너비
    const lineHeight = 28; // 한 칸 세로 이동 간격 (애니메이션 전용)

    // Y 위치 계산용 상수들 (ladderContainer 내부 기준)
    // 상단 원: top=0, height=40
    const startPointTop = 0;
    const startPointHeight = 40;
    const startPointCenterY = startPointTop + startPointHeight / 2;

    // 세로선: top=48 (시작점 40px + 마진 8px)
    const verticalLineTop = 48; // 세로선 시작 위치

    // 하단 원: top = verticalLineTop + HORIZONTAL_LINES * lineHeight + 8, height=45
    const endPointTop = verticalLineTop + HORIZONTAL_LINES * lineHeight + 8;
    const endPointHeight = 45;
    const endPointCenterY = endPointTop + endPointHeight / 2;
    
    // 공 위치 초기화 (시작점) - ladderContainer 내부 기준으로 계산
    // 각 컬럼의 중심에 공의 중심이 오도록: 컬럼 시작점 + 컬럼 중심 - 공 크기/2
    const startX = startLadder * columnWidth + columnWidth / 2 - ballSize / 2;
    // 시작 위치를 살짝 위로 올려서(10px) 세로선과 더 자연스럽게 맞춤
    const startY = START_OFFSET_Y + startPointCenterY - ballSize / 2 - 10; // 시작점 원의 중심보다 10px 위에서 시작
    
    ballPosition.setValue({ x: startX, y: startY });
    ballOpacity.setValue(0);

    // 사다리 가림막 서서히 걷기
    Animated.timing(ladderCoverOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // 공이 나타나는 애니메이션 (useNativeDriver: false로 통일)
    Animated.timing(ballOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false, // ballPosition과 동일하게 false로 변경
    }).start();

    // 사다리를 따라 내려가는 로직
    // 올바른 사다리 게임 알고리즘: 각 레벨에서 가로선을 만나면 반드시 그 방향으로 이동
    let currentLadder = startLadder;

    // 사다리 게임 알고리즘: 각 가로선 레벨을 순차적으로 처리
    // 0번 레벨부터 HORIZONTAL_LINES-1번 레벨까지 처리
    const animateStep = (levelIndex: number) => {
      // 모든 레벨을 처리 완료 → 하단 결과 포인트까지 마지막 세로 이동
      if (levelIndex >= HORIZONTAL_LINES) {
        // 현재 컬럼 기준으로 하단 결과 포인트 중심까지 내려가기
        const finalX = currentLadder * columnWidth + columnWidth / 2 - ballSize / 2;
        const finalY = START_OFFSET_Y + endPointCenterY - ballSize / 2;

        Animated.timing(ballPosition, {
          toValue: {
            x: finalX,
            y: finalY,
          },
          duration: 400,
          useNativeDriver: false,
        }).start(() => {
          // 확률 기반으로 이미 결정된 finalReward 사용
          setResult(finalReward);
          setAnimating(false);
          
          setTimeout(() => {
            onResult(finalReward);
          }, 2000);
        });
        return;
      }

      // 현재 레벨의 Y 위치 계산
      // verticalLine의 top: 48 (시작점 40px + 마진 8px)
      // 각 가로선 레벨은 lineContainer의 중심에 위치 (lineHeight 기준)
      const levelY = START_OFFSET_Y + verticalLineTop + levelIndex * lineHeight + lineHeight / 2 - ballSize / 2;
      
      // X 위치 계산 - 컬럼의 중심에 공의 중심이 오도록 (ladderContainer 내부 기준)
      const currentX = currentLadder * columnWidth + columnWidth / 2 - ballSize / 2;
      
      // 먼저 현재 레벨까지 세로로 내려가기
      Animated.timing(ballPosition, {
        toValue: {
          x: currentX,
          y: levelY,
        },
        duration: 400,
        useNativeDriver: false,
      }).start(() => {
        // 현재 레벨에서 가로선 확인
        // ladderStructure[levelIndex][position]은 position과 position+1 사이의 가로선
        // currentLadder 위치에서:
        // - 오른쪽 가로선: ladderStructure[levelIndex][currentLadder] (currentLadder ↔ currentLadder+1)
        // - 왼쪽 가로선: ladderStructure[levelIndex][currentLadder - 1] (currentLadder-1 ↔ currentLadder)
        const hasRightBridge = currentLadder < LADDERS - 1 && ladderStructure[levelIndex]?.[currentLadder];
        const hasLeftBridge = currentLadder > 0 && ladderStructure[levelIndex]?.[currentLadder - 1];
        
        if (hasRightBridge) {
          // 오른쪽 가로선이 있으면 오른쪽으로 이동 (반드시 이동)
          currentLadder += 1;
          const moveX = currentLadder * columnWidth + columnWidth / 2 - ballSize / 2;
          Animated.timing(ballPosition, {
            toValue: {
              x: moveX,
              y: levelY,
            },
            duration: 300,
            useNativeDriver: false,
          }).start(() => {
            // 다음 레벨로
            setTimeout(() => animateStep(levelIndex + 1), 100);
          });
        } else if (hasLeftBridge) {
          // 왼쪽 가로선이 있으면 왼쪽으로 이동 (반드시 이동)
          currentLadder -= 1;
          const moveX = currentLadder * columnWidth + columnWidth / 2 - ballSize / 2;
          Animated.timing(ballPosition, {
            toValue: {
              x: moveX,
              y: levelY,
            },
            duration: 300,
            useNativeDriver: false,
          }).start(() => {
            // 다음 레벨로
            setTimeout(() => animateStep(levelIndex + 1), 100);
          });
        } else {
          // 가로선 없음 - 바로 다음 레벨로 (세로로만 내려감)
          setTimeout(() => animateStep(levelIndex + 1), 100);
        }
      });
    };

    // 애니메이션 시작
    setTimeout(() => animateStep(0), 500);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎯 사다리 게임</Text>

      {/* 상단 숫자 선택 (1~5) */}
      <View style={styles.topChoicesContainer}>
        {Array.from({ length: LADDERS }).map((_, index) => {
          const isSelected = selectedTopIndex === index;
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.topChoiceButton,
                isSelected && styles.topChoiceButtonSelected,
              ]}
              onPress={() => setSelectedTopIndex(index)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.topChoiceText,
                  isSelected && styles.topChoiceTextSelected,
                ]}
              >
                {index + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 사다리 그리기 */}
      <View style={styles.ladderContainer}>
        {Array.from({ length: LADDERS }).map((_, ladderIndex) => (
          <View key={ladderIndex} style={styles.ladderColumn}>
            {/* 상단 시작점 - 위에 별도 숫자 선택이 있으므로 투명 원으로 정렬만 맞춤 */}
            <View style={styles.startPointEmpty} />
            
            {/* 세로선 */}
            <View style={styles.verticalLine} />
            
            {/* 가로선과 세로선 조합 */}
            {Array.from({ length: HORIZONTAL_LINES }).map((_, lineIndex) => {
              const hasLeftLine = ladderStructure[lineIndex]?.[ladderIndex - 1];
              const hasRightLine = ladderStructure[lineIndex]?.[ladderIndex];
              
              return (
                <View key={lineIndex} style={styles.lineContainer}>
                  {hasLeftLine && (
                    <View style={[styles.horizontalLine, styles.horizontalLineLeft]} />
                  )}
                  <View style={styles.verticalSegment} />
                  {hasRightLine && (
                    <View style={[styles.horizontalLine, styles.horizontalLineRight]} />
                  )}
                </View>
              );
            })}
            
            {/* 하단 결과 포인트 - 각 사다리에 대응되는 포인트 표시 */}
            <View style={styles.endPoint}>
              <Text style={styles.endPointText}>
                {REWARD_PROBABILITIES[ladderIndex].points}P
              </Text>
            </View>
          </View>
        ))}
        
        {/* 애니메이션 공 */}
        <Animated.View
          style={[
            styles.ball,
            {
              opacity: ballOpacity,
              transform: [
                { translateX: ballPosition.x },
                { translateY: ballPosition.y }, // y 값에 오프셋이 이미 포함됨
              ],
            },
          ]}
        >
          <View style={styles.ballInner} />
        </Animated.View>

        {/* 사다리 가림막 + 안내 텍스트 */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ladderCover,
            { opacity: ladderCoverOpacity },
          ]}
        >
          <View style={styles.coverMessageContainer}>
            <Text style={styles.coverMessageText}>
              1~5 중 한 가지 숫자를 선택한 후{'\n'}시작하기 버튼을 눌러주세요
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* 시작하기 버튼 - 애니메이션이 시작되지 않았을 때만 표시 */}
      {!animating && result === null && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={startAnimation}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>시작하기 🎯</Text>
        </TouchableOpacity>
      )}

      {/* 결과 표시 */}
      {result !== null && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultPoints}>{result}P</Text>
          <Text style={styles.resultLabel}>획득!</Text>
        </View>
      )}

      {/* 진행 중 표시 */}
      {animating && result === null && (
        <Text style={styles.loadingText}>사다리를 타는 중... ⬇️</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  topChoicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%', // 사다리와 비슷한 너비
    alignSelf: 'center', // 중앙 정렬
    marginBottom: 12,
  },
  topChoiceButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topChoiceButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  topChoiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  topChoiceTextSelected: {
    color: 'white',
  },
  ladderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    width: '80%', // 화면의 80% 너비만 사용
    alignSelf: 'center', // 중앙 정렬
    position: 'relative',
    minHeight: 280, // 높이 줄임 (600 -> 280)
  },
  ladderColumn: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  startPoint: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  startPointText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  startPointEmpty: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    // 투명하지만 공간은 차지하도록
  },
  verticalLine: {
    width: 3, // 두께 줄임 (6 -> 3)
    backgroundColor: colors.primary,
    height: HORIZONTAL_LINES * 37 + 16, // 높이 계산 (시각적 라인 높이 37 기준)
    position: 'absolute',
    top: 48,
    borderRadius: 2,
  },
  lineContainer: {
    width: '100%',
    height: 37, // 높이 (시각적 라인 높이 37 기준)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  verticalSegment: {
    width: 3, // 두께 줄임 (6 -> 3)
    height: 37, // 높이 (시각적 라인 높이 37 기준)
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  horizontalLine: {
    position: 'absolute',
    height: 3, // 두께 줄임 (6 -> 3)
    backgroundColor: colors.accent,
    zIndex: 1,
    borderRadius: 2,
  },
  horizontalLineLeft: {
    width: '100%',
    right: '50%',
  },
  horizontalLineRight: {
    width: '100%',
    left: '50%',
  },
  endPoint: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  endPointText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  ball: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  ballInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  ladderCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverMessageContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resultContainer: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  resultText: {
    fontSize: 48,
    marginBottom: 6,
  },
  resultPoints: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
});

