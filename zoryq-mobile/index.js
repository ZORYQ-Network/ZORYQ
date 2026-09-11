import React,{useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {registerRootComponent} from 'expo';
import WalletApp from './App';
import Social from './Social';

function Root(){
  const [surface,setSurface]=useState('social');
  return <View style={s.root}>
    <View style={s.switcher}>
      <Pressable onPress={()=>setSurface('social')} style={[s.tab,surface==='social'&&s.active]}><Text style={[s.text,surface==='social'&&s.activeText]}>ZORIQ Social</Text></Pressable>
      <Pressable onPress={()=>setSurface('wallet')} style={[s.tab,surface==='wallet'&&s.active]}><Text style={[s.text,surface==='wallet'&&s.activeText]}>ZORYQ Wallet</Text></Pressable>
    </View>
    <View style={s.body}>{surface==='social'?<Social/>:<WalletApp/>}</View>
  </View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#07080d'},switcher:{height:44,padding:5,backgroundColor:'#080b10',borderBottomWidth:1,borderBottomColor:'#202735',flexDirection:'row',gap:6},tab:{flex:1,borderRadius:10,alignItems:'center',justifyContent:'center'},active:{backgroundColor:'#171e29'},text:{color:'#788396',fontSize:11,fontWeight:'900'},activeText:{color:'#fff'},body:{flex:1}});
registerRootComponent(Root);