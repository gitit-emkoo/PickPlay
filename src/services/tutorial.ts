import firestore from '@react-native-firebase/firestore';
import { UserData } from '../types';
import { recordPointHistory } from './pointHistory';

/**
 * 튜토리얼 상태를 업데이트하고, 3개 미션이 모두 완료되면 500P를 지급합니다.
 * @param uid 사용자 UID
 * @param updateType 업데이트할 튜토리얼 타입
 * @returns 업데이트된 사용자 데이터
 */
export async function updateTutorialProgress(
  uid: string,
  updateType: 'mainAnswered' | 'livepickParticipated' | 'livepickCreated'
): Promise<UserData | null> {
  try {
    const userRef = firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.warn('[Tutorial] 사용자 문서가 없습니다:', uid);
      return null;
    }

    const userData = userDoc.data() as UserData;
    const currentTutorial = userData.tutorial || {
      mainAnswered: false,
      livepickParticipated: false,
      livepickCreated: false,
      rewardGiven500: false,
    };

    // 이미 완료된 미션이면 업데이트하지 않음
    if (currentTutorial[updateType]) {
      console.log(`[Tutorial] 이미 완료된 미션: ${updateType}`);
      return userData as UserData;
    }

    // 튜토리얼 상태 업데이트
    const updatedTutorial = {
      ...currentTutorial,
      [updateType]: true,
    };

    await userRef.update({
      tutorial: updatedTutorial,
    });

    console.log(`[Tutorial] 미션 완료: ${updateType}`, updatedTutorial);

    // 3개 미션이 모두 완료되었고, 아직 보상을 받지 않았으면 500P 지급
    if (
      updatedTutorial.mainAnswered &&
      updatedTutorial.livepickParticipated &&
      updatedTutorial.livepickCreated &&
      !updatedTutorial.rewardGiven500
    ) {
      console.log('[Tutorial] 3개 미션 완료! 500P 지급 시작');
      
      try {
        // 트랜잭션으로 포인트 지급 및 상태 업데이트
        await firestore().runTransaction(async (transaction) => {
          const userDocRef = firestore().collection('users').doc(uid);
          const userDocSnapshot = await transaction.get(userDocRef);
          
          if (!userDocSnapshot.exists) {
            throw new Error('사용자 문서를 찾을 수 없습니다.');
          }
          
          const currentData = userDocSnapshot.data() as UserData;
          const currentPoints = currentData.points || 0;
          
          // 이미 보상을 받았는지 재확인 (동시성 제어)
          if (currentData.tutorial?.rewardGiven500) {
            console.log('[Tutorial] 이미 보상을 받았습니다.');
            return;
          }
          
          // 포인트 증가 및 보상 상태 업데이트
          transaction.update(userDocRef, {
            points: currentPoints + 500,
            'tutorial.rewardGiven500': true,
          });
        });
        
        // 포인트 내역 기록
        await recordPointHistory(uid, 500, 'tutorial_reward', '튜토리얼 완료 보상');
        
        console.log('[Tutorial] 500P 지급 완료');
      } catch (error: any) {
        console.error('[Tutorial] 500P 지급 실패:', error);
        // 에러가 발생하면 보상 상태만 롤백
        await userRef.update({
          'tutorial.rewardGiven500': false,
        });
      }
    }

    // 업데이트된 사용자 데이터 반환
    const updatedDoc = await userRef.get();
    return updatedDoc.data() as UserData;
  } catch (error: any) {
    console.error('[Tutorial] 튜토리얼 상태 업데이트 실패:', error);
    return null;
  }
}

/**
 * 사용자의 튜토리얼 상태를 조회합니다.
 * @param uid 사용자 UID
 * @returns 튜토리얼 상태 객체 또는 null
 */
export async function getTutorialStatus(uid: string): Promise<{
  mainAnswered: boolean;
  livepickParticipated: boolean;
  livepickCreated: boolean;
  rewardGiven500: boolean;
  allCompleted: boolean;
} | null> {
  try {
    const userDoc = await firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as UserData;
    
    // tutorial 필드가 없으면 자동으로 생성 (초기값: 모두 false)
    if (!userData.tutorial) {
      const initialTutorial = {
        mainAnswered: false,
        livepickParticipated: false,
        livepickCreated: false,
        rewardGiven500: false,
      };
      
      // Firestore에 tutorial 필드 생성
      await userRef.update({
        tutorial: initialTutorial,
      });
      
      console.log('[Tutorial] tutorial 필드 자동 생성:', initialTutorial);
      
      return {
        ...initialTutorial,
        allCompleted: false,
      };
    }
    
    const tutorial = userData.tutorial;

    return {
      ...tutorial,
      allCompleted:
        tutorial.mainAnswered &&
        tutorial.livepickParticipated &&
        tutorial.livepickCreated,
    };
  } catch (error: any) {
    console.error('[Tutorial] 튜토리얼 상태 조회 실패:', error);
    return null;
  }
}

