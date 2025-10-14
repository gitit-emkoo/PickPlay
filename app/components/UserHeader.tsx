import LottieView from 'lottie-react-native';
import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import colors from '../styles/colors';
import CharacterCard from './CharacterCard';
import { UserData } from '@/src/types';

interface UserHeaderProps {
  userData: {
    points: number;
    streakCount: number;
    nickname: string;
    totalSelections?: number;
    characterId?: string | null;
    adjective1?: string | null;
    adjective2?: string | null;
  };
}

export default function UserHeader({ userData }: UserHeaderProps) {
  const [showModal, setShowModal] = useState(false);

  const remainingForAnima = Math.max(0, 30 - ((userData.totalSelections ?? 0)));

  return (
    <View style={{
      position: 'absolute',
      top: 22,
      right: 24,
      zIndex: 10,
    }}>
      {/* 메인 유저 정보 카드 */}
      <TouchableOpacity 
        onPress={() => setShowModal(true)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 8,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
          marginBottom: 0
        }}
        activeOpacity={0.7}
      >
        {/* 닉네임 표시 */}
        <View style={{marginBottom: 8}}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            textAlign: 'center'
          }}>
            {userData.nickname}
          </Text>
        </View>
        
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <View style={{width: 24, height: 24}}>
              <LottieView
                source={{ uri: "https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie" }}
                loop={true}
                autoPlay={true}
                style={{ width: 30, height: 30 }}
              />
            </View>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.primary
            }}>
              {userData.points}P
            </Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <View style={{width: 24, height: 24}}>
              <LottieView
                source={{ uri: "https://lottie.host/951ea34e-ef87-45ee-90f2-ac796963312f/NUCSZs3eid.lottie" }}
                loop={true}
                autoPlay={true}
                style={{ width: 24, height: 24 }}
              />
            </View>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.textSecondary
            }}>
              {userData.streakCount}일 연속
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* 상세 정보 모달 */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
            width: 320,
            minHeight: 500,
            alignItems: 'center'
          }}>
          {/* 상단: 포인트와 출석 정보 */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: 20
          }}>
            {/* 포인트 섹션 */}
            <View style={{
              flex: 1,
              alignItems: 'center',
              marginRight: 10
            }}>
              {/* 포인트 로티 */}
              <View style={{ width: 60, height: 60, marginBottom: 8 }}>
                <LottieView
                  source={{ uri: "https://lottie.host/c691c7ab-e2e2-4a77-a50e-cef6c130dce1/GjbXQZOTda.lottie" }}
                  loop={true}
                  autoPlay={true}
                  style={{ width: 60, height: 60 }}
                />
              </View>
              
              {/* 포인트 현황 */}
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.primary,
                textAlign: 'center',
                marginBottom: 8
              }}>
                {userData.points}P
              </Text>
              
              {/* 포인트 설명 */}
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 16
              }}>
                2,000P 부터 자유롭게 사용할 수 있고, 
                연속 달성과 다양한 이벤트를 통해
                더 많은 포인트를 획득할 수 있어!
              </Text>
            </View>

            {/* 출석 섹션 */}
            <View style={{
              flex: 1,
              alignItems: 'center',
              marginLeft: 10
            }}>
              {/* 출석 로티 */}
              <View style={{ width: 60, height: 60, marginBottom: 8 }}>
                <LottieView
                  source={{ uri: "https://lottie.host/951ea34e-ef87-45ee-90f2-ac796963312f/NUCSZs3eid.lottie" }}
                  loop={true}
                  autoPlay={true}
                  style={{ width: 60, height: 60 }}
                />
              </View>
              
              {/* 출석 현황 */}
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.primary,
                textAlign: 'center',
                marginBottom: 8
              }}>
                {userData.streakCount}일 연속 달성
              </Text>
              
              {/* 출석 설명 */}
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 16
              }}>
                30초면 충분해. PickPlay는 99%가 성공할 수 있는 흐름을 만들었고 너는 지금 흐름 안에 있어.
                
              </Text>
            </View>
          </View>

          {/* 하단: 애니마코드 섹션 → 캐릭터 카드로 대체 */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            <CharacterCard 
              userData={{
                // CharacterCard는 characterId/adjective1/adjective2만 사용
                // 부족한 필드는 타입 호환을 위해 최소값으로 채움
                uid: '',
                createdAt: new Date(),
                totalSelections: userData.totalSelections ?? 0,
                characterId: userData.characterId ?? null,
                adjective1: userData.adjective1 ?? null,
                adjective2: userData.adjective2 ?? null,
                points: userData.points,
                streakCount: userData.streakCount,
                lastAnswerDate: 0,
                nickname: userData.nickname,
              } as UserData}
            />

            {/* 안내 문구 - 캐릭터가 없을 때만 표시 */}
            {!userData.characterId && (
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.primary,
                textAlign: 'center',
                lineHeight: 22
              }}>
                AnimaCode 생성을 위한 
                <Text style={{ color: colors.text }}>
                  {remainingForAnima}번의 선택
                </Text>
                이 쌓이면, 너의 내면의 캐릭터가 탄생하고 진짜 이름과 여정이 시작돼!
              </Text>
            )}
          </View>

          {/* 닫기 버튼 */}
          <TouchableOpacity onPress={() => setShowModal(false)} style={{
            marginTop: 20,
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 20,
            alignSelf: 'center'
          }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
      </Modal>
    </View>
  );
}

