import LottieView from 'lottie-react-native';
import React, { useState } from 'react';
import { Dimensions, Image, ScrollView, Text, TouchableOpacity, View, Modal, TextInput, Alert, ActivityIndicator, Clipboard } from 'react-native';
import colors from '../../src/styles/colors';
import { Ionicons } from '@expo/vector-icons';
import { executeDeviceTransfer } from '../../src/services/deviceTransfer';
import { watchAuth } from '../../src/services/firebase';

const { width, height } = Dimensions.get('window');

interface TutorialScreenProps {
  onFinish: () => void;
}

export default function TutorialScreen({ onFinish }: TutorialScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferUID, setTransferUID] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [user, setUser] = useState<{ uid: string } | null>(null);

  // 사용자 인증 확인
  React.useEffect(() => {
    const unsubscribe = watchAuth((authUser) => {
      setUser(authUser);
    });
    return unsubscribe;
  }, []);

  const tutorialCards = [
    {
      title: "매일 나와 마주하는 30초!",
      subtitle: "정말 짧은 시간이지만, 나 자신을 이해하고 돌아보는 소중한 시간들로 쌓여갑니다.",
      description: "PickPlay는 자신을 위한 루틴을 만들어가는 당신의 매일을 보상합니다.",
      image: require('../../assets/images/logo_pickplay.png'),
      backgroundColor: colors.primary
    },
    {
      title: "의미 있고 특별한 선택",
      subtitle: "PickPlay에 정답은 없습니다. 선택이 AnimaCode가 되고 보상이 됩니다.",
      description: "직감이든 취향이든 당신의 선택이 가치로 바뀝니다.",
      image: require('../../assets/images/img_stamp.png'),
      backgroundColor: colors.primary
    },
    {
      title: "애니마코드(AnimaCode)?",
      subtitle: "당신의 선택이 쌓여 탄생한 내면의 캐릭터",
      description: "MBTI처럼 성향 분류 체계이지만, 선택이 이어질수록 계속 진화하는 내면을 시각화한 루틴형 세계예요",
      isLottie: true,
      lottieSource: "https://lottie.host/df96f2a7-284f-4197-ba3c-5b8388c46299/ykDKnFMp3l.lottie",
      backgroundColor: colors.primary
    },
    {
      title: "PickPlay 세계관",
      subtitle: "PickPlay 유니버스는 선택으로 만들어 갑니다",
      description: "다수의 선택은 흐름을 만들고, 소수의 선택은 새로운 방향을 제시한다고 믿습니다. 그래서 PickPlay는 소수의 선택에 조금 더 보상합니다.",
      image: require('../../assets/images/logo_pickplay.png'),
      backgroundColor: colors.primary
    },
    {
      title: "99%의 성공을 위한 도전",
      subtitle: "대부분의 도전을 끝까지 해내는 건 단 1%뿐!PickPlay는 나머지 99%가 성공할 수 있는 흐름을 만들어 갑니다",
      description: "오늘부터 성취감을 향해 달려가 볼까요?\n첫 번째 선택이 기다리고 있어요.",
      isLottie: true,
      lottieSource: "https://lottie.host/951ea34e-ef87-45ee-90f2-ac796963312f/NUCSZs3eid.lottie",
      backgroundColor: colors.primary
    }
  ];

  const handleFinish = () => {
    onFinish();
  };

  const handleResume = async () => {
    if (!user || !transferUID.trim() || !transferPassword.trim()) {
      Alert.alert('입력 오류', '사용자 ID와 비밀번호를 모두 입력해주세요.');
      return;
    }

    Alert.alert(
      '기기 연동',
      '기존 데이터를 불러오시겠습니까?\n\n연동하면 기존 기기의 데이터가 삭제되고, 현재 기기로 모든 정보가 이전됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '이어하기',
          style: 'default',
          onPress: async () => {
            try {
              setTransferLoading(true);
              const result = await executeDeviceTransfer(transferUID.trim(), transferPassword.trim(), user.uid);
              
              if (result.success) {
                Alert.alert('성공', '기존 데이터를 불러왔습니다!', [
                  {
                    text: '확인',
                    onPress: () => {
                      setShowTransferModal(false);
                      setTransferUID('');
                      setTransferPassword('');
                      onFinish(); // 튜토리얼 완료 처리
                    },
                  },
                ]);
              } else {
                Alert.alert('연동 실패', result.error || '기존 데이터를 불러오는데 실패했습니다.');
              }
            } catch (error: any) {
              console.error('연동 실행 실패:', error);
              Alert.alert('오류', error.message || '기존 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
              setTransferLoading(false);
            }
          },
        },
      ]
    );
  };



  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* 메인 카드 영역 */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(newIndex);
          }}
          style={{ flex: 1 }}
        >
          {tutorialCards.map((card, index) => (
            <View key={index} style={{ width, alignItems: 'center', justifyContent: 'center' }}>
              {/* 카드 컨테이너 */}
              <View style={{
                width: width * 0.85,
                height: height * 0.6,
                backgroundColor: card.backgroundColor,
                borderRadius: 24,
                padding: 32,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 8
              }}>
                {/* 이미지 */}
                <View style={{ marginBottom: 32 }}>
                  {card.isLottie ? (
                    <LottieView
                      source={{ uri: card.lottieSource }}
                      loop={true}
                      autoPlay={true}
                      speed={1}
                      style={{
                        width: 120,
                        height: 120
                      }}
                    />
                  ) : (
                    <Image
                      source={card.image}
                      style={{
                        width: 120,
                        height: 120,
                        resizeMode: 'contain'
                      }}
                    />
                  )}
                </View>

                {/* 제목 */}
                <Text style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: 'white',
                  textAlign: 'center',
                  marginBottom: 8,
                  lineHeight: 32
                }}>
                  {card.title}
                </Text>

                {/* 부제목 */}
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.9)',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 24
                }}>
                  {card.subtitle}
                </Text>

                {/* 설명 */}
                <Text style={{
                  fontSize: 16,
                  fontWeight: '400',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textAlign: 'center',
                  lineHeight: 24
                }}>
                  {card.description}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 하단 인디케이터와 버튼 */}
      <View style={{ 
        paddingHorizontal: 24, 
        paddingBottom: 50,
        alignItems: 'center'
      }}>
        {/* 페이지 인디케이터 */}
        <View style={{ 
          flexDirection: 'row', 
          marginBottom: 32,
          gap: 8
        }}>
          {tutorialCards.map((_, index) => (
            <View
              key={index}
              style={{
                width: index === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: index === currentIndex ? colors.primary : colors.border
              }}
            />
          ))}
        </View>

                 {/* 시작하기 버튼 - 마지막 카드에서만 표시 */}
         {currentIndex === tutorialCards.length - 1 && (
           <View style={{ 
             width: '100%', 
             flexDirection: 'row', 
             alignItems: 'center', 
             gap: 12,
             justifyContent: 'center'
           }}>
             <TouchableOpacity
               onPress={handleFinish}
               style={{
                 backgroundColor: colors.primary,
                 borderRadius: 16,
                 paddingVertical: 16,
                 paddingHorizontal: 24,
                 flex: 1,
                 maxWidth: 150,
                 shadowColor: colors.primary,
                 shadowOffset: { width: 0, height: 4 },
                 shadowOpacity: 0.3,
                 shadowRadius: 8,
                 elevation: 8
               }}
             >
               <Text style={{
                 fontSize: 18,
                 fontWeight: '700',
                 color: 'white',
                 textAlign: 'center'
               }}>
                 시작하기
               </Text>
             </TouchableOpacity>

             {/* 이어하기 버튼 */}
             <TouchableOpacity
               onPress={() => setShowTransferModal(true)}
               style={{
                 backgroundColor: 'transparent',
                 borderRadius: 16,
                 paddingVertical: 16,
                 paddingHorizontal: 24,
                 flex: 1,
                 maxWidth: 150,
                 borderWidth: 2,
                 borderColor: colors.primary
               }}
             >
               <Text style={{
                 fontSize: 18,
                 fontWeight: '700',
                 color: colors.primary,
                 textAlign: 'center'
               }}>
                 이어하기
               </Text>
             </TouchableOpacity>
           </View>
         )}
      </View>

      {/* 이어하기 모달 */}
      <Modal
        visible={showTransferModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowTransferModal(false);
          setTransferUID('');
          setTransferPassword('');
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: colors.background,
            borderRadius: 16,
            width: '100%',
            maxWidth: 400,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: colors.text
              }}>
                기존 데이터 불러오기
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTransferModal(false);
                  setTransferUID('');
                  setTransferPassword('');
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                marginBottom: 8
              }}>
                사용자 ID
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
                value={transferUID}
                onChangeText={setTransferUID}
                placeholder="기존 기기의 사용자 ID를 입력하세요"
                placeholderTextColor={colors.textLight}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                marginTop: 16,
                marginBottom: 8
              }}>
                연동 비밀번호
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
                value={transferPassword}
                onChangeText={setTransferPassword}
                placeholder="기존 기기에서 확인한 연동 비밀번호를 입력하세요"
                placeholderTextColor={colors.textLight}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
              />
              
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: '#FFF4E6',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                gap: 8
              }}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.text
                }}>
                  기존 기기에서 "연동준비"를 통해 확인한 ID와 비밀번호를 입력하세요.
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 8,
                padding: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: transferLoading ? 0.6 : 1
              }}
              onPress={handleResume}
              disabled={transferLoading || !transferUID.trim() || !transferPassword.trim()}
            >
              {transferLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#fff'
                }}>
                  이어하기
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
