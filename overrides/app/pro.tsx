import {router} from 'expo-router';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {KyvoLogo} from '@/components/KyvoLogo';
import {Card,GlowButton,Pill} from '@/components/Ui';
import {getProStatus} from '@/services/subscriptions';
import {colors} from '@/theme/colors';

export default function ProScreen(){const pro=getProStatus();return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}><View style={s.head}><KyvoLogo/><Pressable onPress={()=>router.back()}><Text style={s.close}>×</Text></Pressable></View><Pill tone="purple">KYVO PRO</Pill><Text style={s.title}>Mais segurança. Mais inteligência. Menos fricção.</Text><Text style={s.sub}>Plano comercial preparado para recursos premium. A cobrança só será ativada quando os produtos das lojas e o RevenueCat estiverem configurados.</Text>{['Guard avançado e monitoramento contínuo','Rotas inteligentes e automações KYVO ONE','Alertas anti-phishing prioritários','Relatórios de portfólio e histórico avançado','Cosméticos/benefícios de perfil sem vantagem enganosa no airdrop'].map(x=><Card key={x}><Text style={s.item}>✦ {x}</Text></Card>)}<GlowButton title={pro.configured?'Ver planos disponíveis':'PRO em configuração'} lime onPress={()=>{}}/><Text style={s.note}>Status do billing: {pro.configured?'configurado':'aguardando credenciais da loja/RevenueCat'}.</Text></ScrollView></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.bg},content:{padding:16,gap:12},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},close:{color:colors.text,fontSize:34},title:{color:colors.text,fontSize:30,fontWeight:'900',lineHeight:35},sub:{color:colors.muted,fontSize:11,lineHeight:17},item:{color:colors.text,fontSize:12,fontWeight:'700',lineHeight:18},note:{color:colors.muted,fontSize:10,textAlign:'center'}})
