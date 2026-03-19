import firestore from '@react-native-firebase/firestore';
import { UserData } from '../types';
import { recordPointHistory } from './pointHistory';

/**
 * 튜토리얼 상태를 업데이트하고, 3개 미션이 모두 완료되면 500P를 지급합니다.
 * @param uid 사용자 UID
 * @param updateType 업데이트할 튜토리얼 타입
 * @returns 업데이트된 사용자 데이터와 실제로 업데이트가 수행되었는지 여부
 */
export async function updateTutorialProgress(
  uid: string,
  updateType: 'mainAnswered' | 'livepickParticipated' | 'livepickCreated'
): Promise<{ userData: UserData; wasUpdated: boolean } | null> {
  try {
    const userRef = firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.warn('[Tutorial] 사용자 문서가 없습니다:', uid);
      return null;
    }

    const userData = userDoc.data() as UserData;
    const choice = userData.tutorialChoice || 'pending';
    // opt-in 유저만 튜토리얼 진행/보상 가능
    if (choice !== 'opt_in') {
      console.log('[Tutorial] opt-in이 아닌 유저, 튜토리얼 진행 스킵:', { uid, choice, updateType });
      return { userData: userData as UserData, wasUpdated: false };
    }

    const currentTutorial = userData.tutorial || {
      mainAnswered: false,
      livepickParticipated: false,
      livepickCreated: false,
      rewardGiven500: false,
    };

    // 이미 완료된 미션이면 업데이트하지 않음
    if (currentTutorial[updateType]) {
      console.log(`[Tutorial] 이미 완료된 미션: ${updateType}`);
      return { userData: userData as UserData, wasUpdated: false };
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
    return { userData: updatedDoc.data() as UserData, wasUpdated: true };
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
  tutorialChoice: 'pending' | 'opt_in' | 'opt_out';
  allCompleted: boolean;
} | null> {
  try {
    const userRef = firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data() as UserData;
    // 기존 유저 호환:
    // - tutorialChoice가 없고 tutorial 필드가 이미 있으면(과거 튜토리얼 진행/완료 유저) pending으로 보지 않음
    //   -> 완료 유저가 다시 "도전하기" 모달을 보지 않게 하기 위함
    const tutorialChoice =
      userData.tutorialChoice ??
      (userData.tutorial ? 'opt_in' : 'pending');
    
    // opt-in이 아닌 유저는 tutorial이 없어도 그대로 반환 (자동 생성하지 않음)
    const tutorial = userData.tutorial || {
      mainAnswered: false,
      livepickParticipated: false,
      livepickCreated: false,
      rewardGiven500: false,
    };
    
    return {
      ...tutorial,
      tutorialChoice,
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

/**
 * 유저의 튜토리얼 선택 상태를 저장합니다.
 * - opt_in: 튜토리얼 진행/보상 대상
 * - opt_out: 영구 제외
 */
export async function setTutorialChoice(
  uid: string,
  choice: 'opt_in' | 'opt_out'
): Promise<void> {
  const userRef = firestore().collection('users').doc(uid);
  await userRef.update({
    tutorialChoice: choice,
    ...(choice === 'opt_in'
      ? {
          // opt-in 시 tutorial 필드가 없으면 기본 구조를 만들어 둠
          tutorial: {
            mainAnswered: false,
            livepickParticipated: false,
            livepickCreated: false,
            rewardGiven500: false,
          },
        }
      : {}),
  } as any);
}

