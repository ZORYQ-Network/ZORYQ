import React,{useState} from 'react';
import {Pressable,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import MainnetWallet from './MainnetWallet';
import SwapEngine from './SwapEngine';

export default function WalletApp(){
 const [mode,setMode]=useState<'wallet'|'swap'>('wallet');
 return <SafeAreaView style={s.root}>
  <View style={s.switcher}>
   <Pressable style={[s.button,mode==='wallet'&&s.on]} onPress={()=>setMode('wallet')}><Text style={[s.text,mode==='wallet'&&s.textOn]}>Carteira</Text></Pressable>
   <Pressable style={[s.button,mode==='swap'&&s.on]} onPress={()=>setMode('swap')}><Text style={[s.text,mode==='swap'&&s.textOn]}>Swap + Treasury</Text></Pressable>
  </View>
  <View style={s.body}>{mode==='wallet'?<MainnetWallet/>:<SwapEngine/>}</View>
 </SafeAreaView>;
}

const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},switcher:{flexDirection:'row',paddingHorizontal:12,paddingVertical:8,gap:8,borderBottomWidth:1,borderColor:'#1b2030',backgroundColor:'#070a10'},button:{flex:1,paddingVertical:10,borderRadius:12,alignItems:'center',backgroundColor:'#111621'},on:{backgroundColor:'#5d42da'},text:{color:'#8f98ab',fontWeight:'800'},textOn:{color:'#fff'},body:{flex:1}});
