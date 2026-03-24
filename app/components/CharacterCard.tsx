import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { UserData } from '../../src/types'; // Character 타입도 필요할 수 있음
import colors from '../../src/styles/colors';

interface CharacterCardProps {
  userData: UserData | null;
  // characters: Character[]; // 전체 캐릭터 정보가 필요할 경우
}

// 임시 캐릭터 데이터 (실제로는 상위 컴포넌트에서 받아와야 함)
const characters = require('../../assets/data/characters_19.json');

// 캐릭터 이미지 매핑 (실제 존재하는 이미지만)
const characterImages: { [key: string]: any } = {
  // JSON 존재: fox, lion, owl, dolphin, cat, dog, panda, giraffe, deer,
  // polar_bear, rabbit, horse, otter, leopard, camel, meerkat, sheep, tiger
  fox: require('../../assets/images/fox.png'),
  lion: require('../../assets/images/lion.png'),
  owl: require('../../assets/images/owl.png'),
  dolphin: require('../../assets/images/dolphin.png'),
  cat: require('../../assets/images/cat.png'),
  dog: require('../../assets/images/dog.png'),
  panda: require('../../assets/images/panda.png'),
  giraffe: require('../../assets/images/giraffe.png'),
  deer: require('../../assets/images/deer.png'),
  polar_bear: require('../../assets/images/polar_bear.png'),
  rabbit: require('../../assets/images/rabbit.png'),
  horse: require('../../assets/images/horse.png'),
  otter: require('../../assets/images/otter.png'),
  leopard: require('../../assets/images/leopard.png'),
  camel: require('../../assets/images/camel.png'),
  meerkat: require('../../assets/images/meerkat.png'),
  sheep: require('../../assets/images/sheep.png'),
  tiger: require('../../assets/images/tiger.png'),
};

const CharacterCard: React.FC<CharacterCardProps> = ({ userData }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;

  if (!userData) {
    return <ActivityIndicator />;
  }

  const { characterId, adjective1, adjective2 } = userData;
  const character = characters.find((c: any) => c.character_id === characterId);
  
  console.log(`[CharacterCard] 디버그 정보:`, {
    characterId: characterId,
    adjective1: adjective1,
    adjective2: adjective2,
    characterFound: !!character,
    characterName: character?.name,
    totalCharacters: characters.length
  });

  const handleCardPress = () => {
    const toValue = isFlipped ? 0 : 1;
    
    Animated.timing(flipAnimation, {
      toValue,
      duration: 600,
      useNativeDriver: true,
    }).start();
    
    setIsFlipped(!isFlipped);
  };

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MY ANIMA CODE</Text>
      <TouchableOpacity 
        onPress={handleCardPress} 
        activeOpacity={0.7}
        style={styles.touchableArea}
      >
        <View style={styles.cardContainer}>
          {/* 앞면 - 캐릭터 이미지 */}
          <Animated.View style={[styles.card, styles.cardFace, frontAnimatedStyle]}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.gradientBorder}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
            >
              <View style={styles.cardContent}>
                {character ? (
                  <>
                    <Image 
                      source={characterImages[characterId || ''] || require('../../assets/images/icon.png')} 
                      style={styles.characterImage} 
                    />
                    <Text style={styles.characterName}>{character.name}</Text>
                    <Text style={styles.adjectives}>{`${adjective1 || ''} ${adjective2 || ''}`.trim()}</Text>
                  </>
                ) : (
                  <>
                    <LottieView
                      source={{ uri: "https://lottie.host/df96f2a7-284f-4197-ba3c-5b8388c46299/ykDKnFMp3l.lottie" }}
                      loop={true}
                      autoPlay={true}
                      speed={2}
                      style={styles.characterImage}
                    />
                    <Text style={styles.characterName}>???</Text>
                    <Text style={styles.adjectives}>아직은 알 수 없어요</Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* 뒷면 - 텍스트 설명 */}
          <Animated.View style={[styles.card, styles.cardFace, backAnimatedStyle]}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.cardBack}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
            >
              {character ? (
                <>
                  <View style={styles.evolutionContainer}>
                    <Text style={styles.evolutionText}>
                      애니마코드가 탄생했어!
                    </Text>
                    <Text style={styles.evolutionSubText}>
                      앞으로의 선택은 너의 다음 성향을 만들어 갈거야!
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.backTitle}>내 애니마코드는 뭘까?</Text>
                </>
              )}
            </LinearGradient>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  cardContainer: {
    width: 160,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  gradientBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    padding: 2,
  },
  cardContent: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  cardFace: {
    // 기본 카드 스타일
  },
  cardBack: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  characterImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  characterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  adjectives: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  backTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  descriptionContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 3,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  tapHint: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  touchableArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  evolutionContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  evolutionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 3,
  },
  evolutionSubText: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default CharacterCard;
