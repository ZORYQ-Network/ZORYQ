import React,{useState} from 'react';
import {Pressable,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import MainnetWallet from './MainnetWallet';
import SwapEngine from './SwapEngine';
import UnifiedSocialApp from './UnifiedSocialApp';
import CommunitiesApp from './CommunitiesApp';
import MessagesApp from './MessagesApp';
import MobileNodeApp from './MobileNodeApp';
import {ZORYQ_UI} from './theme';

type Mode='social'|'wallet'|'swap'|'communities'|'messages'|'node';
export default function WalletApp(){
 const [mode,setMode]=useState<Mode>('social');
 if(mode==='social')return <View style={s.socialShell}><UnifiedSocialApp onWallet={()=>setMode('wallet')} onSwap={()=>setMode('swap')} onCommunities={()=>setMode('communities')} onMessages={()=>setMode('messages')}/><Pressable accessibilityRole="button" accessibilityLabel="Abrir ZORYQ Mobile Node" style={s.nodeFab} onPress={()=>setMode('node')}><Text style={s.nodeFabDot}>●</Text><Text style={s.nodeFabText}>NODE</Text></Pressable></View>;
 if(mode==='communities')return <CommunitiesApp onBack={()=>setMode('social')}/>;
 if(mode==='messages')return <MessagesApp onBack={()=>setMode('social')}/>;
 if(mode==='node')return <MobileNodeApp onBack={()=>setMode('social')}/>;
 return <SafeAreaView style={s.root}>
  <View style={s.top}><Pressable style={s.back} onPress={()=>setMode('social')}><Text style={s.backText}>← ZORYQ</Text></Pressable><Text style={s.title}>{mode==='wallet'?'Wallet':'Swap'}</Text><View style={s.switch}><Pressable style={[s.pill,mode==='wallet'&&s.on]} onPress={()=>setMode('wallet')}><Text style={s.pillText}>Wallet</Text></Pressable><Pressable style={[s.pill,mode==='swap'&&s.on]} onPress={()=>setMode('swap')}><Text style={s.pillText}>Swap</Text></Pressable><Pressable style={s.pill} onPress={()=>setMode('node')}><Text style={s.pillText}>Node</Text></Pressable></View></View>
  <View style={s.body}>{mode==='wallet'?<MainnetWallet/>:<SwapEngine/>}</View>
 </SafeAreaView>
}
const s=StyleSheet.create({socialShell:{flex:1,backgroundColor:ZORYQ_UI.background},nodeFab:{position:'absolute',right:16,top:54,zIndex:50,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:'#2CD69A',backgroundColor:'rgba(7,18,18,.94)'},nodeFabDot:{color:'#48E6A9',fontSize:10},nodeFabText:{color:'#DFFFEF',fontSize:10,fontWeight:'900',letterSpacing:1},root:{flex:1,backgroundColor:ZORYQ_UI.background},top:{height:52,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:ZORYQ_UI.border,backgroundColor:ZORYQ_UI.background},back:{paddingVertical:8,paddingRight:8},backText:{color:ZORYQ_UI.primary,fontWeight:'900'},title:{color:ZORYQ_UI.text,fontWeight:'900',fontSize:14},switch:{flexDirection:'row',gap:5},pill:{paddingHorizontal:9,paddingVertical:7,borderRadius:10,backgroundColor:ZORYQ_UI.panelSecondary},on:{backgroundColor:ZORYQ_UI.primary},pillText:{color:ZORYQ_UI.text,fontWeight:'800',fontSize:10},body:{flex:1}});
