import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Wallet,hexlify,randomBytes} from 'ethers';
import {createClient,RealtimeChannel,Session} from '@supabase/supabase-js';

const SUPABASE_URL=process.env.EXPO_PUBLIC_SUPABASE_URL||'https://juordakzclqefpuauzjq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_XucQLaJTlznyM_mKee3WOg_hgE0Os6r';
const WALLET_KEY='zoryq.wallet.privateKey';
const CHAIN_ID=5919065;
const SIWE_DOMAIN=process.env.EXPO_PUBLIC_ZORYQ_SIWE_DOMAIN||'zoryq-testnet.vercel.app';
const SIWE_URI=process.env.EXPO_PUBLIC_ZORYQ_SIWE_URI||`https://${SIWE_DOMAIN}/zoriq`;

export const socialSupabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false},
 realtime:{params:{eventsPerSecond:10}}
});

export type SocialProfile={id:string;username:string|null;display_name:string|null;bio:string|null;avatar_url:string|null;reputation_score:number|null;interests:string[]|null;power_key:string|null;human_score:number|null;profile_visibility:string|null;discoverable:boolean|null;show_reputation:boolean|null;allow_mentions?:boolean|null;allow_tagging?:boolean|null;hide_engagement_counts?:boolean|null;reduce_motion?:boolean|null;dm_mode?:string|null};
export type SocialPost={id:string;author_id:string;body:string|null;visibility:string;media_url:string|null;likes_count:number;comments_count:number;reposts_count:number;bookmarks_count:number;created_at:string};
export type BackendState={configured:boolean;authenticated:boolean;session:Session|null};
export type ReportTarget='post'|'comment'|'profile'|'message';
export type ReportReason='spam'|'scam'|'harassment'|'hate'|'violence'|'sexual'|'impersonation'|'privacy'|'other';
export type ConversationSummary={id:string;name:string;handle:string;avatar_url:string|null;other_user_id:string|null;updated_at:string;last_message:string;last_message_at:string;unread:boolean};
export type SocialMessage={id:string;conversation_id:string;sender_id:string;body:string|null;message_type:string;created_at:string;edited_at:string|null;deleted_at:string|null};

export async function getBackendState():Promise<BackendState>{
 const {data,error}=await socialSupabase.auth.getSession();
 if(error)throw error;
 return {configured:Boolean(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY),authenticated:Boolean(data.session),session:data.session};
}

export function watchAuth(cb:(state:BackendState)=>void){
 const {data}=socialSupabase.auth.onAuthStateChange((_event,session)=>cb({configured:true,authenticated:Boolean(session),session}));
 return ()=>data.subscription.unsubscribe();
}

export async function signInWithLocalWallet():Promise<Session>{
 const privateKey=await SecureStore.getItemAsync(WALLET_KEY);
 if(!privateKey)throw new Error('wallet_missing');
 const wallet=new Wallet(privateKey);
 const nonce=hexlify(randomBytes(8)).slice(2);
 const issuedAt=new Date().toISOString();
 const message=`${SIWE_DOMAIN} wants you to sign in with your Ethereum account:\n${wallet.address}\n\nSign in to ZORIQ Social. No blockchain transaction or gas is required.\n\nURI: ${SIWE_URI}\nVersion: 1\nChain ID: ${CHAIN_ID}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
 const signature=await wallet.signMessage(message);
 const {data,error}=await socialSupabase.auth.signInWithWeb3({chain:'ethereum',message,signature:signature as `0x${string}`});
 if(error)throw error;
 if(!data.session)throw new Error('social_session_not_created');
 return data.session;
}

export async function signOutSocial(){const {error}=await socialSupabase.auth.signOut();if(error)throw error}

async function requireSession():Promise<Session>{const {data,error}=await socialSupabase.auth.getSession();if(error)throw error;if(!data.session)throw new Error('auth_required');return data.session}

export async function getMyProfile():Promise<SocialProfile|null>{
 const session=await requireSession();
 const {data,error}=await socialSupabase.from('profiles').select('id,username,display_name,bio,avatar_url,reputation_score,interests,power_key,human_score,profile_visibility,discoverable,show_reputation,allow_mentions,allow_tagging,hide_engagement_counts,reduce_motion,dm_mode').eq('id',session.user.id).maybeSingle();
 if(error)throw error;return data as SocialProfile|null;
}

export async function listProfileCards(ids:string[]):Promise<SocialProfile[]>{
 if(!ids.length)return [];
 const {data,error}=await socialSupabase.rpc('social_public_profiles',{p_search:null,p_ids:ids,p_limit:Math.min(ids.length,50)});
 if(error)throw error;return (data||[]) as SocialProfile[];
}

export async function listDiscoverableProfiles(search=''):Promise<SocialProfile[]>{
 const clean=search.trim().slice(0,80)||null;
 const {data,error}=await socialSupabase.rpc('social_public_profiles',{p_search:clean,p_ids:null,p_limit:30});
 if(error)throw error;return (data||[]) as SocialProfile[];
}

export async function listVisibleFeed(limit=30):Promise<SocialPost[]>{
 const safeLimit=Math.max(1,Math.min(limit,50));
 const {data,error}=await socialSupabase.from('posts').select('id,author_id,body,visibility,media_url,likes_count,comments_count,reposts_count,bookmarks_count,created_at').order('created_at',{ascending:false}).limit(safeLimit);
 if(error)throw error;
 const posts=(data||[]) as SocialPost[];
 const {data:{session}}=await socialSupabase.auth.getSession();
 if(!session||!posts.length)return posts;
 const {data:hidden,error:hiddenError}=await socialSupabase.from('post_hides').select('post_id').eq('user_id',session.user.id).in('post_id',posts.map(p=>p.id));
 if(hiddenError)return posts;
 const hiddenIds=new Set((hidden||[]).map(x=>String(x.post_id)));
 return posts.filter(p=>!hiddenIds.has(p.id));
}

export async function listMyFollowIds():Promise<string[]>{const session=await requireSession();const {data,error}=await socialSupabase.from('user_follows').select('following_id').eq('follower_id',session.user.id);if(error)throw error;return (data||[]).map(x=>String(x.following_id))}
export async function listBlockedIds():Promise<string[]>{const session=await requireSession();const {data,error}=await socialSupabase.from('user_blocks').select('blocked_id').eq('blocker_id',session.user.id);if(error)throw error;return (data||[]).map(x=>String(x.blocked_id))}
export async function listMutedIds():Promise<string[]>{const session=await requireSession();const {data,error}=await socialSupabase.from('user_mutes').select('muted_id').eq('muter_id',session.user.id);if(error)throw error;return (data||[]).map(x=>String(x.muted_id))}
export async function listFollowRequests(){const session=await requireSession();const {data,error}=await socialSupabase.from('follow_requests').select('requester_id,created_at').eq('target_id',session.user.id).order('created_at',{ascending:false});if(error)throw error;return data||[]}
export async function declineFollowRequest(requesterId:string){const session=await requireSession();const {error}=await socialSupabase.from('follow_requests').delete().eq('target_id',session.user.id).eq('requester_id',requesterId);if(error)throw error}

export async function updateMyProfile(input:{display_name?:string;username?:string;bio?:string;profile_visibility?:string;discoverable?:boolean;show_reputation?:boolean;allow_mentions?:boolean;allow_tagging?:boolean;hide_engagement_counts?:boolean;reduce_motion?:boolean;power_key?:string;social_dna?:Record<string,number>;dm_mode?:'everyone'|'following'|'nobody'}){const session=await requireSession();const payload={...input,updated_at:new Date().toISOString()};const {data,error}=await socialSupabase.from('profiles').update(payload).eq('id',session.user.id).select().single();if(error)throw error;return data}

export async function toggleFollow(profileId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_follow',{p_following_id:profileId});if(error)throw error;return data}
export async function acceptFollowRequest(requesterId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_accept_follow_request',{p_requester_id:requesterId});if(error)throw error;return data}
export async function toggleLike(postId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_like',{p_post_id:postId});if(error)throw error;return data}
export async function toggleBookmark(postId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_bookmark',{p_post_id:postId});if(error)throw error;return data}
export async function toggleRepost(postId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_repost',{p_post_id:postId});if(error)throw error;return data}
export async function setReaction(postId:string,emoji:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_set_reaction',{p_post_id:postId,p_emoji:emoji});if(error)throw error;return data}
export async function addComment(postId:string,body:string){await requireSession();const text=body.trim();if(!text||text.length>1000)throw new Error('invalid_comment');const {data,error}=await socialSupabase.rpc('social_add_comment',{p_post_id:postId,p_body:text});if(error)throw error;return data}

export async function createPost(body:string,visibility:'public'|'followers'='public'){const session=await requireSession();const text=body.trim();if(text.length<1||text.length>500)throw new Error('invalid_post');const {data,error}=await socialSupabase.from('posts').insert({author_id:session.user.id,body:text,visibility}).select().single();if(error)throw error;return data}

export async function setBlocked(profileId:string,blocked:boolean){const session=await requireSession();if(blocked){const {error}=await socialSupabase.from('user_blocks').upsert({blocker_id:session.user.id,blocked_id:profileId});if(error)throw error}else{const {error}=await socialSupabase.from('user_blocks').delete().eq('blocker_id',session.user.id).eq('blocked_id',profileId);if(error)throw error}}
export async function setMuted(profileId:string,muted:boolean){const session=await requireSession();if(muted){const {error}=await socialSupabase.from('user_mutes').upsert({muter_id:session.user.id,muted_id:profileId});if(error)throw error}else{const {error}=await socialSupabase.from('user_mutes').delete().eq('muter_id',session.user.id).eq('muted_id',profileId);if(error)throw error}}

export async function hidePost(postId:string,reason:'not_interested'|'repetitive'|'irrelevant'='not_interested'){const session=await requireSession();const {error}=await socialSupabase.from('post_hides').upsert({user_id:session.user.id,post_id:postId,reason});if(error)throw error}
export async function unhidePost(postId:string){const session=await requireSession();const {error}=await socialSupabase.from('post_hides').delete().eq('user_id',session.user.id).eq('post_id',postId);if(error)throw error}
export async function reportContent(targetType:ReportTarget,targetId:string,reason:ReportReason,details=''){const session=await requireSession();const clean=details.trim().slice(0,1000);const {data,error}=await socialSupabase.from('content_reports').upsert({reporter_id:session.user.id,target_type:targetType,target_id:targetId,reason,details:clean||null},{onConflict:'reporter_id,target_type,target_id'}).select().single();if(error)throw error;return data}

export async function startConversation(otherUserId:string):Promise<string>{await requireSession();const {data,error}=await socialSupabase.rpc('start_direct_conversation',{other_user:otherUserId});if(error)throw error;if(!data)throw new Error('conversation_not_created');return String(data)}
export async function listMessages(conversationId:string):Promise<SocialMessage[]>{await requireSession();const {data,error}=await socialSupabase.from('messages').select('id,conversation_id,sender_id,body,message_type,created_at,edited_at,deleted_at').eq('conversation_id',conversationId).order('created_at',{ascending:true}).limit(150);if(error)throw error;return (data||[]) as SocialMessage[]}
export async function sendMessage(conversationId:string,body:string){const session=await requireSession();const text=body.trim();if(!text||text.length>4000)throw new Error('invalid_message');const {data,error}=await socialSupabase.from('messages').insert({conversation_id:conversationId,sender_id:session.user.id,body:text,message_type:'text'}).select().single();if(error)throw error;return data}
export async function markConversationRead(conversationId:string){const session=await requireSession();const {error}=await socialSupabase.from('conversation_members').update({last_read_at:new Date().toISOString()}).eq('conversation_id',conversationId).eq('user_id',session.user.id);if(error)throw error}

export async function listConversations():Promise<ConversationSummary[]>{
 const session=await requireSession();
 const {data:mine,error:mineError}=await socialSupabase.from('conversation_members').select('conversation_id,last_read_at').eq('user_id',session.user.id);if(mineError)throw mineError;
 const ids=(mine||[]).map(x=>String(x.conversation_id));if(!ids.length)return [];
 const [{data:convs,error:convError},{data:members,error:memberError},{data:messages,error:messageError}]=await Promise.all([
  socialSupabase.from('conversations').select('id,updated_at').in('id',ids).order('updated_at',{ascending:false}),
  socialSupabase.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids),
  socialSupabase.from('messages').select('id,conversation_id,sender_id,body,created_at').in('conversation_id',ids).order('created_at',{ascending:false}).limit(200)
 ]);
 if(convError)throw convError;if(memberError)throw memberError;if(messageError)throw messageError;
 const otherIds=[...new Set((members||[]).map(x=>String(x.user_id)).filter(id=>id!==session.user.id))];
 const profiles=await listProfileCards(otherIds);
 const profileMap=new Map(profiles.map(p=>[p.id,p]));
 const mineMap=new Map((mine||[]).map(x=>[String(x.conversation_id),x.last_read_at?String(x.last_read_at):'']));
 const lastByConv=new Map<string,any>();for(const m of messages||[]){const id=String(m.conversation_id);if(!lastByConv.has(id))lastByConv.set(id,m)}
 return (convs||[]).map(c=>{const cid=String(c.id);const other=String((members||[]).find(x=>String(x.conversation_id)===cid&&String(x.user_id)!==session.user.id)?.user_id||'');const p=profileMap.get(other);const last=lastByConv.get(cid);const lastRead=mineMap.get(cid)||'';const lastAt=last?.created_at?String(last.created_at):'';return {id:cid,name:p?.display_name||p?.username||'Usuário ZORIQ',handle:p?.username?`@${p.username}`:'@zoriq',avatar_url:p?.avatar_url||null,other_user_id:other||null,updated_at:String(c.updated_at||lastAt),last_message:String(last?.body||''),last_message_at:lastAt,unread:Boolean(lastAt&&last?.sender_id!==session.user.id&&(!lastRead||new Date(lastAt)>new Date(lastRead)))} as ConversationSummary})
}

export async function listNotifications(){const session=await requireSession();const {data,error}=await socialSupabase.from('notifications').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);if(error)throw error;return data||[]}
export async function markNotificationRead(id:string){const session=await requireSession();const {error}=await socialSupabase.from('notifications').update({is_read:true}).eq('id',id).eq('user_id',session.user.id);if(error)throw error}
export async function markAllNotificationsRead(){const session=await requireSession();const {error}=await socialSupabase.from('notifications').update({is_read:true}).eq('user_id',session.user.id).eq('is_read',false);if(error)throw error}

export function subscribeSocial(onChange:()=>void,userId?:string):RealtimeChannel{
 const channel=socialSupabase.channel(`zoriq-social-${userId||'public'}`).on('postgres_changes',{event:'*',schema:'public',table:'posts'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'comments'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'post_likes'},onChange);
 if(userId)channel.on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${userId}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'user_follows'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'follow_requests',filter:`target_id=eq.${userId}`},onChange).on('postgres_changes',{event:'*',schema:'public',table:'messages'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'xp_events',filter:`user_id=eq.${userId}`},onChange);
 channel.subscribe();return channel;
}
export async function stopSocialSubscription(channel:RealtimeChannel){await socialSupabase.removeChannel(channel)}