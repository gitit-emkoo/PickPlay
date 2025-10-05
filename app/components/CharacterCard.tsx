import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import LottieView from 'lottie-react-native';
import { UserData } from '../types'; // Character 타입도 필요할 수 있음

interface CharacterCardProps {
  userData: UserData | null;
  // characters: Character[]; // 전체 캐릭터 정보가 필요할 경우
}

// 임시 캐릭터 데이터 (실제로는 상위 컴포넌트에서 받아와야 함)
const characters = require('../../assets/data/characters_19.json');

const CharacterCard: React.FC<CharacterCardProps> = ({ userData }) => {
  if (!userData) {
    return <ActivityIndicator />;
  }

  const { characterId, adjective1, adjective2 } = userData;
  const character = characters.find((c: any) => c.character_id === characterId);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MY ANIMA CODE</Text>
      <View style={styles.card}>
        {character ? (
          <>
            <Image source={{ uri: character.image_url }} style={styles.characterImage} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  characterImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 12,
  },
  characterName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  adjectives: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
});

export default CharacterCard;
