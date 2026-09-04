import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZoryqLogo } from '@/components/ZoryqLogo';
import { Card, Pill, SectionTitle } from '@/components/Ui';
import { colors } from '@/theme/colors';
import { quests } from '@/data/mock';
import { useApp } from '@/context/AppContext';
import { useLocale } from '@/context/LocaleContext';

export default function XpScreen() {
  const { xp, level, streak, completed, addXp } = useApp();
  const { t } = useLocale();
  const next = 8000;
  const progress = Math.min(100, (xp / next) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><ZoryqLogo compact /><View><Text style={styles.title}>{t('xpRewards')}</Text><Text style={styles.subtitle}>{t('journey')}</Text></View></View>

        <Card style={styles.hero}>
          <View style={styles.levelCol}><Text style={styles.eyebrow}>{t('level').toUpperCase()}</Text><Text style={styles.level}>{level}</Text><Text style={styles.purple}>✦ Stellar Voyager</Text></View>
          <View style={styles.ring}><Text style={styles.ringXp}>{xp.toLocaleString('pt-BR')}</Text><Text style={styles.ringSub}>/ {next.toLocaleString('pt-BR')} XP</Text></View>
          <View style={styles.levelCol}><Text style={styles.eyebrow}>PRÓXIMO</Text><Text style={[styles.level, { color: colors.violet }]}>{level + 1}</Text><Text style={styles.cyan}>{Math.max(0, next - xp).toLocaleString('pt-BR')} XP faltando</Text></View>
          <View style={styles.fullProgress}><View style={[styles.fullProgressFill, { width: `${progress}%` }]} /></View>
        </Card>

        <Card style={styles.airdrop}>
          <View style={{ flex: 1 }}><Text style={styles.eyebrow}>{t('airdrop')}</Text><Text style={styles.coming}>{t('comingSoon')}</Text><Text style={styles.body}>O futuro está chegando. Continue ativo. XP e status não garantem alocação de token.</Text></View>
          <Text style={styles.gift}>✦</Text>
        </Card>

        <View>
          <SectionTitle title={t('xpQuests')} action="24H" />
          <Card style={{ paddingVertical: 4 }}>
            {quests.map((q, index) => {
              const done = Boolean(completed[q.id]);
              return (
                <Pressable
                  key={q.id}
                  onPress={() => addXp(q.reward, q.id)}
                  style={[styles.quest, index < quests.length - 1 && styles.questBorder]}
                >
                  <View style={styles.questIcon}><Text style={styles.questIconText}>{q.icon}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.questTitle}>{q.title}</Text><Text style={styles.questSub}>{q.subtitle}</Text></View>
                  <View style={{ alignItems: 'flex-end' }}><Text style={styles.reward}>+{q.reward} XP</Text><Text style={done ? styles.done : styles.todo}>{done ? 'Concluído' : '0 / 1'}</Text></View>
                </Pressable>
              );
            })}
          </Card>
        </View>

        <View style={styles.twoCol}>
          <Card style={styles.half}>
            <Text style={styles.eyebrow}>{t('referEarn')}</Text>
            <Text style={styles.cyanBig}>+1,250 XP</Text>
            <Text style={styles.body}>Convide amigos reais. Anti-sybil e limites serão aplicados no backend.</Text>
            <Pressable style={styles.invite}><Text style={styles.inviteText}>Convidar amigos ↗</Text></Pressable>
          </Card>
          <Card style={styles.half}>
            <Text style={styles.eyebrow}>{t('yourStatus')}</Text>
            <View style={styles.statuses}>
              <Pill tone="green">✓ Wallet verificada</Pill>
              <Pill tone="orange">🔥 Streak {streak}</Pill>
              <Pill tone="cyan">Social ativo</Pill>
              <Pill tone="purple">Multi-chain</Pill>
            </View>
          </Card>
        </View>

        <Card>
          <SectionTitle title={t('achievements')} action={t('viewAll')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {[['✦','Nível atual'], ['⇄','Swap Master'], ['◎','Socializer'], ['🔥','Streak Hero'], ['★','Early Voyager']].map(([icon, title], i) => (
              <View key={title} style={[styles.badgeWrap, i === 4 && { opacity: 0.35 }]}>
                <View style={styles.badge}><Text style={styles.badgeIcon}>{icon}</Text></View>
                <Text style={styles.badgeTitle}>{title}</Text><Text style={styles.badgeSub}>{i === 4 ? 'Bloqueado' : 'Desbloqueado'}</Text>
              </View>
            ))}
          </ScrollView>
        </Card>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 1.3 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0D0B16', borderColor: '#45345B' },
  levelCol: { width: '27%' },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  level: { color: colors.text, fontSize: 44, fontWeight: '900', marginTop: 5 },
  purple: { color: '#B987FF', fontSize: 10, fontWeight: '800' },
  cyan: { color: colors.cyan, fontSize: 10, fontWeight: '800' },
  ring: { width: 112, height: 112, borderRadius: 56, borderWidth: 11, borderTopColor: colors.violet, borderRightColor: colors.purple, borderBottomColor: colors.cyan, borderLeftColor: '#1F2130', alignItems: 'center', justifyContent: 'center' },
  ringXp: { color: colors.text, fontSize: 22, fontWeight: '900' },
  ringSub: { color: colors.muted, fontSize: 9, marginTop: 2 },
  fullProgress: { width: '100%', height: 6, backgroundColor: '#252337', borderRadius: 99, overflow: 'hidden', marginTop: 18 },
  fullProgressFill: { height: '100%', backgroundColor: colors.violet },
  airdrop: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171027', borderColor: '#613298' },
  coming: { color: '#DAC0FF', fontSize: 31, fontWeight: '900', marginTop: 5 },
  body: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  gift: { color: colors.lime, fontSize: 70, marginHorizontal: 10 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  questBorder: { borderBottomWidth: 1, borderBottomColor: '#202230' },
  questIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#191225', alignItems: 'center', justifyContent: 'center' },
  questIconText: { color: colors.violet, fontSize: 20, fontWeight: '900' },
  questTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  questSub: { color: colors.muted, fontSize: 9, marginTop: 3 },
  reward: { color: colors.cyan, fontSize: 11, fontWeight: '900' },
  todo: { color: colors.muted, fontSize: 9, marginTop: 5 },
  done: { color: colors.green, fontSize: 9, marginTop: 5, fontWeight: '800' },
  twoCol: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  cyanBig: { color: colors.cyan, fontSize: 19, fontWeight: '900', marginTop: 10 },
  invite: { marginTop: 12, borderWidth: 1, borderColor: '#7343AF', borderRadius: 12, padding: 9, alignItems: 'center' },
  inviteText: { color: '#CC9BFF', fontSize: 10, fontWeight: '800' },
  statuses: { marginTop: 12, gap: 8 },
  badgeWrap: { width: 86, alignItems: 'center' },
  badge: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#231239', borderWidth: 1, borderColor: '#7547AC', alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { color: '#D9B9FF', fontSize: 25 },
  badgeTitle: { color: colors.text, fontSize: 9, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  badgeSub: { color: colors.muted, fontSize: 8, marginTop: 2 }
});
