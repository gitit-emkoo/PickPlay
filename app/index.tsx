import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet, SafeAreaView } from 'react-native';
import { loadData, ensureUser, getTodayQuestionForUser, saveAnswerAndProcessLogic, aggregate } from './services/store';
import { Question, UserData } from './types';
import { watchAuth } from './services/firebase';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import CharacterCard from './components/CharacterCard';
import { currentDateKey } from './utils/date';

export default function App() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [userChoice, setUserChoice] = useState<number | null>(null);
  const [agg, setAgg] = useState({ p0: 50, p1: 50 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const unsub = watchAuth(setUser);
    return unsub;
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      const data = await ensureUser(user.uid);
      setUserData(data);
      
      // 오늘 이미 투표했는지 확인하여 UI 상태 설정
      if (data.lastAnswerDate === currentDateKey()) {
        // TODO: 어떤 선택을 했는지 알아내서 userChoice에 설정해야 함
        // 우선은 투표한 사실만 반영
        setUserChoice(0); // 임시로 0으로 설정
      } else {
        setUserChoice(null);
      }

      const q = getTodayQuestionForUser(data);
      setQuestion(q);
      if (q) {
        const result = await aggregate(q.question_id);
        setAgg(result);
      }
      setLoading(false);
    };
    init();
  }, [user]);

  const handleVote = async (index: 0 | 1) => {
    if (!user || !userData || !question || userChoice !== null) return;
    try {
      const updatedUserData = await saveAnswerAndProcessLogic(userData, question, index);
      setUserData(updatedUserData);
      setUserChoice(index);
      const result = await aggregate(question.question_id);
      setAgg(result);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Could not save your vote.");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!question) return <ErrorScreen title="오늘의 질문을 불러오지 못했습니다." />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {userData && (
          <View style={styles.header}>
            <Text>안녕하세요, {userData.nickname}님!</Text>
            <Text>포인트: {userData.points} | 연속: {userData.streakCount}일</Text>
          </View>
        )}

        <CharacterCard userData={userData} />

        <View style={styles.card}>
          <Text style={styles.questionText}>{question.text}</Text>
          <TouchableOpacity 
            style={[styles.option, userChoice === 0 && styles.selectedOption]} 
            onPress={() => handleVote(0)}
            disabled={userChoice !== null}
          >
            <Text>{question.option_1_text}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.option, userChoice === 1 && styles.selectedOption]} 
            onPress={() => handleVote(1)}
            disabled={userChoice !== null}
          >
            <Text>{question.option_2_text}</Text>
          </TouchableOpacity>
        </View>

        {userChoice !== null && (
          <View style={styles.card}>
            <Text>결과: {agg.p0}% vs {agg.p1}%</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  content: { padding: 16 },
  header: { marginBottom: 16, padding: 16, backgroundColor: 'white', borderRadius: 8 },
  characterCard: { marginBottom: 16, padding: 16, backgroundColor: '#eef2ff', borderRadius: 8, alignItems: 'center' },
  characterTitle: { fontWeight: 'bold', marginBottom: 8 },
  card: { backgroundColor: 'white', borderRadius: 8, padding: 16, marginBottom: 16 },
  questionText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  option: { padding: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginVertical: 8 },
  selectedOption: { borderColor: 'blue', backgroundColor: '#eef2ff' },
});
