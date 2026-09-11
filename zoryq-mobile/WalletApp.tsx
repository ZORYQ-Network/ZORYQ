import React,{useState} from 'react';
import {Pressable,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import MainnetWallet from './MainnetWallet';
import SwapEngine from './SwapEngine';
import SocialProApp from './SocialProApp';

type Mode='social'|'wallet'|'swap';
export default function WalletApp(){
 const [mode,setMode]=useState<Mode>('social');
 if(mode==='social')return <SocialProApp onWallet={()=>setMode('wallet')} onSwap={()=>setMode('swap')}/>;
 return <SafeAreaView style={s.root}>
  <View style={s.top}><Pressable style={s.back} onPress={()=>setMode('social')}><Text style={s.backText}>← Social</Text></Pressable><Text style={s.title}>{mode==='wallet'?'ZORYQ Wallet':'ZORYQ Swap'}</Text><View style={s.switch}><Pressable style={[s.pill,mode==='wallet'&&s.on]} onPress={()=>setMode('wallet')}><Text style={s.pillText}>Wallet</Text></Pressable><Pressable style={[s.pill,mode==='swap'&&s.on]} onPress={()=>setMode('swap')}><Text style={s.pillText}>Swap</Text></Pressable></View></View>
  <View style={s.body}>{mode==='wallet'?<MainnetWallet/>:<SwapEngine/>}</View>
 </SafeAreaView>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},top:{height:52,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#171d29',backgroundColor:'#06080d'},back:{paddingVertical:8,paddingRight:8},backText:{color:'#9f87ff',fontWeight:'900'},title:{color:'#fff',fontWeight:'900',fontSize:14},switch:{flexDirection:'row',gap:5},pill:{paddingHorizontal:9,paddingVertical:7,borderRadius:10,backgroundColor:'#111722'},on:{backgroundColor:'#3f327b'},pillText:{color:'#d9deea',fontWeight:'800',fontSize:10},body:{flex:1}});
