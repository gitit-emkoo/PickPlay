import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Animated, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/styles/colors';
import { LivePickQuestion } from '../../src/types/livepick';
import { getLivePickQuestions, getTodayParticipationCount } from '../../src/services/livepick';
import { watchAuth } from '../../src/services/firebase';
import { getTutorialStatus } from '../../src/services/tutorial';
import TutorialTooltip from '../components/TutorialTooltip';

const CATEGORIES: Array<'일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'> = ['일상', '연애', '가치관', '엔터테인먼트', '상상'];

export default function LivePickScreen() {
  const router = useRouter();
  const isFirstMountRef = useRef(true);
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [questions, setQuestions] = useState<LivePickQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;
  const [todayParticipationCount, setTodayParticipationCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<'전체' | '일상' | '연애' | '가치관' | '엔터테인먼트' | '상상'>('전체');
  const [tutorialStatus, setTutorialStatus] = useState<{
    mainAnswered: boolean;
    livepickParticipated: boolean;
    livepickCreated: boolean;
    rewardGiven500: boolean;
    allCompleted: boolean;
  } | null>(null);
  
  // 튜토리얼 말풍선 표시 여부 (한 번만 표시)
  const [hasSeenLivepickTooltip, setHasSeenLivepickTooltip] = useState(false);
  const [hasSeenCreateTooltip, setHasSeenCreateTooltip] = useState(false);

  // 검색 및 정렬 상태
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const searchModalAnim = useRef(new Animated.Value(0)).current;
  
  // 전체 질문 목록 (검색 및 정렬용)
  const [allQuestions, setAllQuestions] = useState<LivePickQuestion[]>([]);
  const [isLoadingAllQuestions, setIsLoadingAllQuestions] = useState(false);

  // 오늘 참여 횟수 확인 (먼저 정의)
  const checkTodayParticipationCount = React.useCallback(async (uid: string) => {
    try {
      const count = await getTodayParticipationCount(uid);
      setTodayParticipationCount(count);
    } catch (error) {
      console.error('오늘 참여 횟수 확인 실패:', error);
    }
  }, []);

  // 사용자 인증 확인 및 초기 데이터 로드
  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      setUser(user);
      if (user) {
        // 오늘 참여 횟수 확인
        checkTodayParticipationCount(user.uid);
        
        // 튜토리얼 상태 로드
        try {
          const status = await getTutorialStatus(user.uid);
          if (status) {
            setTutorialStatus(status);
          } else {
            // 신규 유저의 경우 null이 반환될 수 있음
            console.log('[Tutorial] 튜토리얼 상태 없음 (신규 유저일 수 있음)');
            setTutorialStatus({
              mainAnswered: false,
              livepickParticipated: false,
              livepickCreated: false,
              rewardGiven500: false,
              allCompleted: false,
            });
          }
          
          // 튜토리얼 말풍선 표시 여부 확인
          const [hasSeenLivepick, hasSeenCreate] = await Promise.all([
            AsyncStorage.getItem('hasSeenLivepickTutorialTooltip'),
            AsyncStorage.getItem('hasSeenCreateTutorialTooltip'),
          ]);
          setHasSeenLivepickTooltip(hasSeenLivepick === 'true');
          setHasSeenCreateTooltip(hasSeenCreate === 'true');
        } catch (e) {
          console.warn('[Tutorial] 튜토리얼 상태 로드 실패:', e);
          // 에러 발생 시 기본값 설정
          setTutorialStatus({
            mainAnswered: false,
            livepickParticipated: false,
            livepickCreated: false,
            rewardGiven500: false,
            allCompleted: false,
          });
        }
      }
    });
    return unsubscribe;
  }, [checkTodayParticipationCount]);

  // 전체 질문 목록 로드 (검색 및 정렬용)
  const loadAllQuestionsRef = useRef(false);
  const loadAllQuestions = React.useCallback(async () => {
    if (loadAllQuestionsRef.current) return; // 이미 로딩 중이면 중복 실행 방지
    loadAllQuestionsRef.current = true;
    setIsLoadingAllQuestions(true);
    try {
      // 정렬 기준에 따라 모든 질문 가져오기 (큰 limit 사용)
      const allList = await getLivePickQuestions(1000, undefined, sortBy);
      setAllQuestions(allList);
      console.log(`[LivePick] 전체 질문 로드 완료: ${allList.length}개`);
    } catch (error: any) {
      console.error('❌ [LivePick] 전체 질문 목록 로드 실패:', error);
      // 인기순 정렬 인덱스가 아직 생성되지 않은 경우 최신순으로 폴백
      if (error?.code === 'failed-precondition' && sortBy === 'popular') {
        console.warn('[LivePick] 인기순 정렬 인덱스가 아직 생성되지 않았습니다. 최신순으로 전환합니다.');
        setSortBy('latest'); // sortBy 상태를 최신순으로 변경
        try {
          const allList = await getLivePickQuestions(1000, undefined, 'latest');
          setAllQuestions(allList);
        } catch (e) {
          console.error('❌ [LivePick] 최신순 로드 실패:', e);
        }
      }
    } finally {
      setIsLoadingAllQuestions(false);
      loadAllQuestionsRef.current = false;
    }
  }, [sortBy]);

  // 라이브픽 질문 초기 로드
  const loadInitialQuestions = React.useCallback(async (isRefresh: boolean = false) => {
    try {
      // 새로고침일 때는 상단 스피너(RefreshControl)만 사용하고,
      // 전체 화면 로딩 인디케이터는 초기 진입 시에만 사용
      if (!isRefresh) {
        setLoading(true);
      }
      // 검색을 위해 전체 질문을 백그라운드에서 로드
      loadAllQuestions().catch(e => console.warn('[LivePick] 전체 질문 로드 실패:', e));
      // 페이지네이션용으로 첫 20개만 표시 (Firestore 쿼리 레벨에서 정렬)
      const list = await getLivePickQuestions(PAGE_SIZE, undefined, sortBy);
      setQuestions(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch (error: any) {
      console.error('❌ [LivePick] 질문 목록 초기 로드 실패:', error);
      console.error('❌ 에러 타입:', typeof error);
      console.error('❌ 에러 메시지:', error?.message);
      console.error('❌ 에러 코드:', error?.code);
      console.error('❌ 에러 스택:', error?.stack);
      console.error('❌ 에러 전체:', JSON.stringify(error, null, 2));
      // 인기순 정렬 인덱스가 아직 생성되지 않은 경우 최신순으로 폴백
      if (error?.code === 'failed-precondition' && sortBy === 'popular') {
        try {
          const list = await getLivePickQuestions(PAGE_SIZE, undefined, 'latest');
          setQuestions(list);
          setHasMore(list.length === PAGE_SIZE);
        } catch (e) {
          console.error('❌ [LivePick] 최신순 로드 실패:', e);
        }
      }
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [sortBy, loadAllQuestions]);

  // 첫 마운트 시 질문 목록 로드
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      loadInitialQuestions(false);
    }
  }, [loadInitialQuestions]);

  // 화면이 포커스를 받을 때마다 질문 목록 새로고침 (목록으로 가기 버튼 클릭 시)
  const lastRefreshTimeRef = useRef<number>(0);
  useFocusEffect(
    React.useCallback(() => {
      // 첫 마운트가 아닌 경우에만 새로고침
      if (!isFirstMountRef.current && user) {
        const now = Date.now();
        // 1초 이내 중복 새로고침 방지
        if (now - lastRefreshTimeRef.current < 1000) {
          return;
        }
        lastRefreshTimeRef.current = now;
        console.log('[LivePick] 화면 포커스 감지, 질문 목록 새로고침');
        // loadInitialQuestions를 직접 호출하지 않고, 필요한 데이터만 새로고침
        (async () => {
          try {
            setRefreshing(true);
            // 참여 횟수 갱신
            if (user) {
              checkTodayParticipationCount(user.uid).catch(e => 
                console.warn('[LivePick] 참여 횟수 갱신 실패:', e)
              );
            }
            const list = await getLivePickQuestions(PAGE_SIZE, undefined, sortBy);
            setQuestions(list);
            setHasMore(list.length === PAGE_SIZE);
            // 전체 질문은 백그라운드에서만 로드 (검색용, 이미 로드된 경우 제외)
            if (allQuestions.length === 0 && !loadAllQuestionsRef.current) {
              loadAllQuestions().catch(e => console.warn('[LivePick] 전체 질문 로드 실패:', e));
            }
          } catch (e: any) {
            console.warn('[LivePick] 질문 목록 갱신 실패:', e);
            // 인기순 정렬 인덱스가 아직 생성되지 않은 경우 최신순으로 폴백
            if (e?.code === 'failed-precondition' && sortBy === 'popular') {
              console.warn('[LivePick] 인기순 정렬 인덱스가 아직 생성되지 않았습니다. 최신순으로 전환합니다.');
              setSortBy('latest'); // sortBy 상태를 최신순으로 변경
              try {
                const list = await getLivePickQuestions(PAGE_SIZE, undefined, 'latest');
                setQuestions(list);
                setHasMore(list.length === PAGE_SIZE);
              } catch (err) {
                console.error('❌ [LivePick] 최신순 로드 실패:', err);
              }
            }
          } finally {
            setRefreshing(false);
          }
        })();
      }
    }, [user, sortBy, checkTodayParticipationCount])
  );


  // 추가 로드 (페이지네이션)
  const loadMoreQuestions = async () => {
    if (loadingMore || !hasMore || questions.length === 0) return;
    
    // 검색 중이면 필터링된 결과의 다음 페이지를 가져옴
    if (searchQuery.trim()) {
      const currentLength = questions.length;
      const nextPage = filteredQuestions.slice(currentLength, currentLength + PAGE_SIZE);
      
      if (nextPage.length === 0) {
        setHasMore(false);
        return;
      }
      
      setQuestions(prev => [...prev, ...nextPage]);
      setHasMore(currentLength + nextPage.length < filteredQuestions.length);
      return;
    }
    
    // 검색이 없으면 Firestore에서 다음 페이지 가져오기 (정렬은 Firestore 쿼리 레벨에서)
    try {
      setLoadingMore(true);
      const last = questions[questions.length - 1];
      let more: LivePickQuestion[];
      if (sortBy === 'popular') {
        more = await getLivePickQuestions(PAGE_SIZE, undefined, sortBy, last.participantCount);
      } else {
        more = await getLivePickQuestions(PAGE_SIZE, last.createdAt as Date, sortBy);
      }
      if (more.length === 0) {
        setHasMore(false);
        return;
      }
      setQuestions(prev => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (error: any) {
      console.error('❌ [LivePick] 추가 질문 로드 실패:', error);
      // 인기순 정렬 인덱스가 아직 생성되지 않은 경우 최신순으로 폴백
      if (error?.code === 'failed-precondition' && sortBy === 'popular') {
        try {
          const last = questions[questions.length - 1];
          const more = await getLivePickQuestions(PAGE_SIZE, last.createdAt as Date, 'latest');
          if (more.length === 0) {
            setHasMore(false);
            return;
          }
          setQuestions(prev => [...prev, ...more]);
          setHasMore(more.length === PAGE_SIZE);
        } catch (e) {
          console.error('❌ [LivePick] 최신순 로드 실패:', e);
        }
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // 정렬 변경 핸들러
  const handleSortChange = async (newSort: 'latest' | 'popular') => {
    setSortBy(newSort);
    setShowSortDropdown(false);
    // 정렬 변경 시 Firestore 쿼리 레벨에서 정렬된 첫 20개만 로드 (성능 최적화)
    setLoading(true);
    try {
      // Firestore 쿼리 레벨에서 정렬된 결과의 첫 20개만 가져오기 (전체 질문을 로드하지 않음)
      const list = await getLivePickQuestions(PAGE_SIZE, undefined, newSort);
      setQuestions(list);
      setHasMore(list.length === PAGE_SIZE);
      // 전체 질문도 백그라운드에서 업데이트 (검색용, 정렬은 Firestore에서 처리)
      loadAllQuestions().catch(e => console.warn('[LivePick] 전체 질문 로드 실패:', e));
    } catch (error: any) {
      console.error('❌ [LivePick] 정렬 변경 후 질문 목록 로드 실패:', error);
      // 인덱스가 아직 생성되지 않은 경우 최신순으로 폴백
      if (error?.code === 'failed-precondition' && newSort === 'popular') {
        Alert.alert(
          '인기순 정렬 준비 중',
          '인기순 정렬 기능이 준비 중입니다. 잠시 후 다시 시도해주세요.',
          [{ text: '확인', onPress: () => {
            setSortBy('latest');
            // 최신순으로 다시 로드
            getLivePickQuestions(PAGE_SIZE, undefined, 'latest').then(list => {
              setQuestions(list);
              setHasMore(list.length === PAGE_SIZE);
              setLoading(false);
            }).catch(e => {
              console.error('❌ [LivePick] 최신순 로드 실패:', e);
              setLoading(false);
            });
          }}]
        );
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  // 검색 모달 애니메이션 및 전체 질문 로드
  useEffect(() => {
    if (showSearchModal) {
      Animated.spring(searchModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
      
      // 검색 모달이 열릴 때 전체 질문이 없으면 로드
      if (allQuestions.length === 0 && !isLoadingAllQuestions) {
        loadAllQuestions();
      }
    } else {
      Animated.timing(searchModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showSearchModal, searchModalAnim, allQuestions.length, isLoadingAllQuestions, loadAllQuestions]);
  

  // 검색 필터링된 질문 목록 (전체 질문 기준)
  const filteredQuestions = React.useMemo(() => {
    // 검색어가 있으면 전체 질문에서 검색, 없으면 현재 페이지네이션된 질문 사용
    const sourceQuestions = searchQuery.trim() ? allQuestions : questions;
    let filtered = sourceQuestions;
    
    // 카테고리 필터
    if (selectedCategory !== '전체') {
      filtered = filtered.filter((q) => q.category === selectedCategory);
    }
    
    // 검색어 필터 (전체 질문에서 검색)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((q) => 
        q.title.toLowerCase().includes(query) ||
        q.option1.toLowerCase().includes(query) ||
        q.option2.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [questions, allQuestions, selectedCategory, searchQuery]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    // 참여 횟수 갱신
    if (user) {
      checkTodayParticipationCount(user.uid).catch(e => 
        console.warn('[LivePick] 참여 횟수 갱신 실패:', e)
      );
    }
    await loadInitialQuestions(true);
  };

  // 시간 포맷팅 함수
  // - 24시간 이내: "N분 전" / "N시간 전"
  // - 24시간 이상: "YYYY.MM.DD"
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    // 24시간 이상 지난 경우: 날짜로 표시
    if (hours >= 24) {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}.${month}.${day}`;
    }

    // 24시간 이내: "N시간 전" / "N분 전" / "방금 전"
    if (hours > 0) {
      return `${hours}시간 전`;
    } else if (minutes > 0) {
      return `${minutes}분 전`;
    } else {
      return '방금 전';
    }
  };

  // 질문 카드 컴포넌트 (React.memo로 최적화)
  const QuestionCard = React.memo(({ question }: { question: LivePickQuestion }) => {
    const timeAgo = React.useMemo(() => formatTimeAgo(question.createdAt as Date), [question.createdAt]);
    const option1Percent = React.useMemo(() => 
      question.participantCount > 0 
        ? Math.round((question.option1Count / question.participantCount) * 100)
        : 0,
      [question.participantCount, question.option1Count]
    );
    const option2Percent = React.useMemo(() => 
      question.participantCount > 0 ? 100 - option1Percent : 0,
      [question.participantCount, option1Percent]
    );
    const hasVotes = question.participantCount > 0;

    const handlePress = React.useCallback(() => {
      router.push(`/(tabs)/livepick/${question.id}`);
    }, [question.id]);

    return (
      <TouchableOpacity
        style={styles.questionCard}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <Text style={styles.questionTitle}>{question.title}</Text>
        
        <View style={styles.optionsContainer}>
          <View style={styles.optionItem}>
            <Text style={styles.optionText}>{question.option1}</Text>
            <Text style={[styles.optionPercent, styles.optionPercentLeft]}>{option1Percent}%</Text>
          </View>
          <View style={styles.optionDivider} />
          <View style={styles.optionItem}>
            <Text style={styles.optionText}>{question.option2}</Text>
            <Text style={[styles.optionPercent, styles.optionPercentRight]}>{option2Percent}%</Text>
          </View>
        </View>

        <View style={[styles.progressBar, !hasVotes && styles.progressBarEmpty]}>
          {hasVotes && (
            <View style={[styles.progressFill, { width: `${option1Percent}%` }]} />
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="people" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>{question.participantCount}명 참여</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>{timeAgo}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>라이브픽</Text>
          {/* 일일 참여 제한 표시 */}
          {user && (
            <View style={styles.participationBadge}>
              <Ionicons name="time" size={14} color={todayParticipationCount >= 4 ? colors.warning : colors.primary} />
              <Text style={[
                styles.participationText,
                todayParticipationCount >= 4 && styles.participationTextLimit
              ]}>
                오늘 {todayParticipationCount}/4회
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {/* 검색 버튼 */}
          <TouchableOpacity
            style={styles.searchButton}
            activeOpacity={0.7}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search" size={20} color={colors.primary} />
          </TouchableOpacity>
          
          {/* 정렬 버튼 */}
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={styles.sortButton}
              activeOpacity={0.7}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Ionicons name="menu" size={20} color={colors.primary} />
            </TouchableOpacity>
            
            {/* 정렬 드롭다운 */}
            {showSortDropdown && (
              <>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setShowSortDropdown(false)}
                />
                <View style={styles.sortDropdown}>
                  <TouchableOpacity
                    style={[styles.sortOption, sortBy === 'latest' && styles.sortOptionActive]}
                    onPress={() => handleSortChange('latest')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sortOptionText, sortBy === 'latest' && styles.sortOptionTextActive]}>
                      최신순
                    </Text>
                    {sortBy === 'latest' && <Ionicons name="checkmark" size={16} color="white" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortOption, sortBy === 'popular' && styles.sortOptionActive]}
                    onPress={() => handleSortChange('popular')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sortOptionText, sortBy === 'popular' && styles.sortOptionTextActive]}>
                      인기순
                    </Text>
                    {sortBy === 'popular' && <Ionicons name="checkmark" size={16} color="white" />}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
          
          {/* 질문 만들기 버튼 */}
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/livepick/create')}
            >
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={styles.createButtonText}>질문 만들기</Text>
            </TouchableOpacity>
            
            {/* 튜토리얼 말풍선 (질문 만들기 안내) - 라이브픽 참여 후 한 번만 표시 */}
            {tutorialStatus && tutorialStatus.livepickParticipated && !tutorialStatus.livepickCreated && !hasSeenCreateTooltip && (
              <TutorialTooltip
                message="나만의 라이브픽 질문을 만들어보세요"
                position="right"
                style={{ position: 'absolute', top: -10, right: '100%', marginRight: 8 }}
                width={200}
                color="#FF5722"
                blink={true}
                onDismiss={async () => {
                  await AsyncStorage.setItem('hasSeenCreateTutorialTooltip', 'true');
                  setHasSeenCreateTooltip(true);
                }}
              />
            )}
          </View>
        </View>
      </View>

      {/* 카테고리 필터 */}
      <View style={styles.categoryFilter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategory === '전체' && styles.categoryButtonActive,
            ]}
            onPress={() => setSelectedCategory('전체')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategory === '전체' && styles.categoryButtonTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 질문 리스트 */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyText}>질문 목록을 불러오는 중...</Text>
          </View>
        ) : (() => {
          // 필터링된 결과를 항상 사용 (카테고리 필터 적용)
          const displayQuestions = filteredQuestions;

          if (displayQuestions.length === 0) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="flame-outline" size={64} color={colors.textLight} />
                <Text style={styles.emptyText}>
                  {selectedCategory === '전체' ? '아직 질문이 없어요' : `${selectedCategory} 카테고리 질문이 없어요`}
                </Text>
                <Text style={styles.emptySubtext}>
                  {selectedCategory === '전체' ? '첫 번째 질문을 만들어보세요!' : '다른 카테고리를 확인해보세요!'}
                </Text>
              </View>
            );
          }

          return (
            <>
              {displayQuestions.map((question) => (
                <QuestionCard key={question.id} question={question} />
              ))}
              {hasMore && !loadingMore && (
                <TouchableOpacity
                  style={{ marginTop: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}
                  activeOpacity={0.7}
                  onPress={loadMoreQuestions}
                >
                  <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '600', marginRight: 4 }}>
                    더보기
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              {loadingMore && (
                <View style={{ marginTop: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>

      {/* 라이브픽 튜토리얼 말풍선 - 화면 최상단 오버레이로 표시 (한 번만 표시) */}
      {tutorialStatus && !tutorialStatus.livepickParticipated && !hasSeenLivepickTooltip && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 140, // 헤더 + 카테고리 바로 아래 정도
            left: 0,
            right: 0,
            zIndex: 1000,
            alignItems: 'center',
          }}
        >
          <TutorialTooltip
            message="라이브픽 질문에 한 번 참여해보세요"
            position="bottom"
            style={{}}
            color="#FF5722"
            blink={true}
            onDismiss={async () => {
              await AsyncStorage.setItem('hasSeenLivepickTutorialTooltip', 'true');
              setHasSeenLivepickTooltip(true);
            }}
          />
        </View>
      )}

      {/* 검색 모달 */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <TouchableOpacity
          style={styles.searchModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSearchModal(false)}
        >
          <Animated.View
            style={[
              styles.searchModalContent,
              {
                transform: [
                  {
                    translateY: searchModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-300, 0],
                    }),
                  },
                ],
                opacity: searchModalAnim,
              },
            ]}
          >
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>질문 검색</Text>
              <TouchableOpacity
                onPress={() => setShowSearchModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchInputIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="질문 제목이나 선택지를 검색하세요"
                placeholderTextColor={colors.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  activeOpacity={0.7}
                  style={styles.searchClearButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.trim() && (
              <Text style={styles.searchResultText}>
                {filteredQuestions.length}개의 질문을 찾았습니다
              </Text>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  participationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  participationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  participationTextLimit: {
    color: colors.warning,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionItem: {
    flex: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionPercent: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  optionPercentLeft: {
    color: colors.primary,
  },
  optionPercentRight: {
    color: colors.accent,
  },
  optionDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.accent,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarEmpty: {
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  categoryFilter: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  categoryFilterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortDropdown: {
    position: 'absolute',
    top: 48,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    minWidth: 120,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: colors.primary,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sortOptionTextActive: {
    color: 'white',
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchModalContent: {
    backgroundColor: colors.background,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInputIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
  },
  searchClearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchResultText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
});
