import React,{useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import WalletCore from './App';
import MultiChainWallet from './MultiChainWallet';

export default function WalletHub(){
 const [mode,setMode]=useState<'zoryq'|'multi'>('zoryq');
 return <View style={s.root}>
  <View style={s.switcher}>
   <Pressable onPress={()=>setMode('zoryq')} style={[s.tab,mode==='zoryq'&&s.tabOn]}><Text style={[s.tabText,mode==='zoryq'&&s.tabTextOn]}>ZORYQ</Text></Pressable>
   <Pressable onPress={()=>setMode('multi')} style={[s.tab,mode==='multi'&&s.tabOn]}><Text style={[s.tabText,mode==='multi'&&s.tabTextOn]}>MULTICHAIN</Text></Pressable>
  </View>
  <View style={s.body}>{mode==='zoryq'?<WalletCore/>:<MultiChainWallet/>}</View>
 </View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#07080d'},switcher:{height:38,marginHorizontal:13,marginTop:7,marginBottom:3,alignSelf:'flex-start',padding:3,borderRadius:12,backgroundColor:'#0c121a',borderWidth:1,borderColor:'#1a2635',flexDirection:'row',gap:3},tab:{paddingHorizontal:11,borderRadius:9,alignItems:'center',justifyContent:'center'},tabOn:{backgroundColor:'#182333'},tabText:{color:'#64738a',fontSize:8,fontWeight:'900',letterSpacing:.8},tabTextOn:{color:'#cfe0f5'},body:{flex:1}});
