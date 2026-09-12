import React,{useState} from 'react';
import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import ZoriqRoot from './ZoriqRoot';
import MobileNode from './MobileNode';

export default function ZoriqCompleteRoot(){
  const [nodeOpen,setNodeOpen]=useState(false);
  return <SafeAreaProvider>
    <View style={s.root}>
      <ZoriqRoot/>
      <Pressable accessibilityLabel="Abrir ZORYQ Mobile Node" onPress={()=>setNodeOpen(true)} style={s.nodeFab}>
        <View style={s.liveDot}/><Text style={s.nodeFabText}>NODE</Text>
      </Pressable>
      <Modal visible={nodeOpen} animationType="slide" onRequestClose={()=>setNodeOpen(false)}>
        <SafeAreaView style={s.modal} edges={['top','left','right','bottom']}>
          <StatusBar style="light" backgroundColor="#07080d" translucent={false}/>
          <View style={s.header}>
            <View><Text style={s.brand}>ZORIQ</Text><Text style={s.sub}>MOBILE NODE / TESTNET</Text></View>
            <Pressable accessibilityLabel="Fechar Mobile Node" onPress={()=>setNodeOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable>
          </View>
          <MobileNode/>
        </SafeAreaView>
      </Modal>
    </View>
  </SafeAreaProvider>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#07080d',position:'relative'},
  nodeFab:{position:'absolute',right:14,bottom:86,height:42,paddingHorizontal:15,borderRadius:21,backgroundColor:'#101923',borderWidth:1,borderColor:'#35506b',flexDirection:'row',alignItems:'center',gap:7,elevation:12,shadowColor:'#000',shadowOpacity:.35,shadowRadius:8,shadowOffset:{width:0,height:4}},
  liveDot:{width:8,height:8,borderRadius:4,backgroundColor:'#49e58b'},nodeFabText:{color:'#fff',fontSize:11,fontWeight:'900',letterSpacing:1.1},
  modal:{flex:1,backgroundColor:'#07080d'},header:{height:58,paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:'#1b2230',backgroundColor:'#080b10',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{color:'#fff',fontSize:17,fontWeight:'900',letterSpacing:3},sub:{color:'#65e6c4',fontSize:9,fontWeight:'900',letterSpacing:1.3,marginTop:2},close:{width:42,height:42,borderRadius:14,backgroundColor:'#121923',alignItems:'center',justifyContent:'center'},closeText:{color:'#fff',fontSize:26,lineHeight:28}
});
