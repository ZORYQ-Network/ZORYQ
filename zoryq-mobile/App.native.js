import React from 'react';
import {View} from 'react-native';
import WalletHub from './WalletHub';
import ExternalWalletConnect from './ExternalWalletConnect';

export default function WalletNative(){
  return <View style={{flex:1,position:'relative'}}><WalletHub/><ExternalWalletConnect/></View>;
}
