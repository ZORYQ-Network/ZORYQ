import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/context/AppContext';
import { SpotifyProvider } from '@/context/SpotifyContext';
import { LocaleProvider } from '@/context/LocaleContext';
export default function RootLayout(){return <LocaleProvider><AppProvider><SpotifyProvider><StatusBar style="light"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#07070B'}}}><Stack.Screen name="(tabs)"/><Stack.Screen name="wallet" options={{presentation:'modal'}}/><Stack.Screen name="settings" options={{presentation:'card'}}/><Stack.Screen name="guard" options={{presentation:'card'}}/><Stack.Screen name="one" options={{presentation:'card'}}/><Stack.Screen name="pro" options={{presentation:'card'}}/></Stack></SpotifyProvider></AppProvider></LocaleProvider>}
