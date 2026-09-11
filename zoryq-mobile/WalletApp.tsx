import React,{useState} from 'react';
import {Pressable,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import MainnetWallet from './MainnetWallet';
import SwapEngine from './SwapEngine';
import SocialApp from './SocialApp';

type Mode='wallet'|'social'|'swap';
export default function WalletApp(){
 const [mode,setMode]=useState<Mode>('social');
 return <SafeAreaView style={s.root}>
  <View style={s.brandBar}><Text style={s.brand}>ZORYQ</Text><Text style={s.super}>WEB3 SUPER APP · PRE-MAINNET</Text></View>
  <View style={s.body}>{mode==='wallet'?<MainnetWallet/>:mode==='swap'?<SwapEngine/>:<SocialApp/>}</View>
  <View style={s.nav}>
   <Nav active={mode==='social'} label="Social" icon="◉" onPress={()=>setMode('social')}/>
   <Nav active={mode==='wallet'} label="Wallet" icon="◇" onPress={()=>setMode('wallet')}/>
   <Nav active={mode==='swap'} label="Swap" icon="⇄" onPress={()=>setMode('swap')}/>
  </View>
 </SafeAreaView>;
}
function Nav({active,label,icon,onPress}:{active:boolean;label:string;icon:string;onPress:()=>void}){return <Pressable style={s.navItem} onPress={onPress}><Text style={[s.icon,active&&s.active]}>{icon}</Text><Text style={[s.navText,active&&s.active]}>{label}</Text></Pressable>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},brandBar:{height:36,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#06080d',borderBottomWidth:1,borderColor:'#151b27'},brand:{color:'#fff',fontWeight:'900',letterSpacing:2,fontSize:14},super:{color:'#596277',fontWeight:'800',fontSize:8,letterSpacing:.8},body:{flex:1},nav:{height:62,flexDirection:'row',backgroundColor:'#080b11',borderTopWidth:1,borderColor:'#1a2030',paddingBottom:5},navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:2},icon:{color:'#687188',fontSize:20,fontWeight:'900'},navText:{color:'#687188',fontSize:11,fontWeight:'800'},active:{color:'#9c84ff'}});
