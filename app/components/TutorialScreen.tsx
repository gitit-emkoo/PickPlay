import LottieView from 'lottie-react-native';
import React, { useState } from 'react';
import { Dimensions, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import colors from '../styles/colors';

const { width, height } = Dimensions.get('window');

interface TutorialScreenProps {
  onFinish: () => void;
}

export default function TutorialScreen({ onFinish }: TutorialScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

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
           <TouchableOpacity
             onPress={handleFinish}
             style={{
               backgroundColor: colors.primary,
               borderRadius: 16,
               paddingVertical: 16,
               paddingHorizontal: 48,
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
         )}
      </View>
    </View>
  );
}
