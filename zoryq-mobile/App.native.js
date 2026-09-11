import React from 'react';
import {View} from 'react-native';
import WalletCore from './App.tsx';
import ExternalWalletConnect from './ExternalWalletConnect';

export default function WalletNative(){
  return <View style={{flex:1,position:'relative'}}><WalletCore/><ExternalWalletConnect/></View>;
}
