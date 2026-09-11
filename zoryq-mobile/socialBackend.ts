import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient,RealtimeChannel,Session} from '@supabase/supabase-js';

const SUPABASE_URL=process.env.EXPO_PUBLIC_SUPABASE_URL||'https://juordakzclqefpuauzjq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_XucQLaJTlznyM_mKee3WOg_hgE0Os6r';

export const socialSupabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{
  storage:AsyncStorage,
  autoRefreshToken:true,
  persistSession:true,
  detectSessionInUrl:false
 },
 realtime:{params:{eventsPerSecond:10}}
});

export type SocialProfile={
 id:string;
 username:string|null;
 display_name:string|null;
 bio:string|null;
 avatar_url:string|null;
 reputation_score:number|null;
 interests:string[]|null;
 power_key:string|null;
 human_score:number|null;
 profile_visibility:string|null;
 discoverable:boolean|null;
 show_reputation:boolean|null;
};

export type SocialPost={
 id:string;
 author_id:string;
 body:string|null;
 visibility:string;
 media_url:string|null;
 likes_count:number;
 comments_count:number;
 reposts_count:number;
 bookmarks_count:number;
 created_at:string;
};

export type BackendState={configured:boolean;authenticated:boolean;session:Session|null};

export async function getBackendState():Promise<BackendState>{
 const {data}=await socialSupabase.auth.getSession();
 return {configured:Boolean(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY),authenticated:Boolean(data.session),session:data.session};
}

export async function listDiscoverableProfiles(search=''):Promise<SocialProfile[]>{
 let query=socialSupabase.from('profiles').select('id,username,display_name,bio,avatar_url,reputation_score,interests,power_key,human_score,profile_visibility,discoverable,show_reputation').eq('discoverable',true).order('reputation_score',{ascending:false}).limit(30);
 const clean=search.trim().replace(/[%_,()]/g,' ');
 if(clean)query=query.or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%,bio.ilike.%${clean}%`);
 const {data,error}=await query;
 if(error)throw error;
 return (data||[]) as SocialProfile[];
}

export async function listVisibleFeed(limit=30):Promise<SocialPost[]>{
 const safeLimit=Math.max(1,Math.min(limit,50));
 const {data,error}=await socialSupabase.from('posts').select('id,author_id,body,visibility,media_url,likes_count,comments_count,reposts_count,bookmarks_count,created_at').order('created_at',{ascending:false}).limit(safeLimit);
 if(error)throw error;
 return (data||[]) as SocialPost[];
}

async function requireSession():Promise<Session>{
 const {data,error}=await socialSupabase.auth.getSession();
 if(error)throw error;
 if(!data.session)throw new Error('auth_required');
 return data.session;
}

export async function updateMyProfile(input:{display_name?:string;username?:string;bio?:string;profile_visibility?:string;discoverable?:boolean;show_reputation?:boolean;allow_mentions?:boolean;allow_tagging?:boolean;hide_engagement_counts?:boolean;reduce_motion?:boolean;power_key?:string;social_dna?:Record<string,number>}){
 const session=await requireSession();
 const payload={...input,updated_at:new Date().toISOString()};
 const {data,error}=await socialSupabase.from('profiles').update(payload).eq('id',session.user.id).select().single();
 if(error)throw error;
 return data;
}

export async function toggleFollow(profileId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_follow',{p_following_id:profileId});if(error)throw error;return data}
export async function acceptFollowRequest(requesterId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_accept_follow_request',{p_requester_id:requesterId});if(error)throw error;return data}
export async function toggleLike(postId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_like',{p_post_id:postId});if(error)throw error;return data}
export async function toggleBookmark(postId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_bookmark',{p_post_id:postId});if(error)throw error;return data}
export async function toggleRepost(postId:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_toggle_repost',{p_post_id:postId});if(error)throw error;return data}
export async function setReaction(postId:string,emoji:string){await requireSession();const {data,error}=await socialSupabase.rpc('social_set_reaction',{p_post_id:postId,p_emoji:emoji});if(error)throw error;return data}
export async function addComment(postId:string,body:string){await requireSession();const text=body.trim();if(!text||text.length>1000)throw new Error('invalid_comment');const {data,error}=await socialSupabase.rpc('social_add_comment',{p_post_id:postId,p_body:text});if(error)throw error;return data}

export async function createPost(body:string,visibility:'public'|'followers'='public'){
 const session=await requireSession();
 const text=body.trim();
 if(text.length<1||text.length>500)throw new Error('invalid_post');
 const {data,error}=await socialSupabase.from('posts').insert({author_id:session.user.id,body:text,visibility}).select().single();
 if(error)throw error;
 return data;
}

export async function setBlocked(profileId:string,blocked:boolean){
 const session=await requireSession();
 if(blocked){const {error}=await socialSupabase.from('user_blocks').upsert({blocker_id:session.user.id,blocked_id:profileId});if(error)throw error}
 else{const {error}=await socialSupabase.from('user_blocks').delete().eq('blocker_id',session.user.id).eq('blocked_id',profileId);if(error)throw error}
}

export async function setMuted(profileId:string,muted:boolean){
 const session=await requireSession();
 if(muted){const {error}=await socialSupabase.from('user_mutes').upsert({muter_id:session.user.id,muted_id:profileId});if(error)throw error}
 else{const {error}=await socialSupabase.from('user_mutes').delete().eq('muter_id',session.user.id).eq('muted_id',profileId);if(error)throw error}
}

export async function startConversation(otherUserId:string):Promise<string>{
 await requireSession();
 const {data,error}=await socialSupabase.rpc('start_direct_conversation',{other_user:otherUserId});
 if(error)throw error;
 if(!data)throw new Error('conversation_not_created');
 return String(data);
}

export async function sendMessage(conversationId:string,body:string){
 const session=await requireSession();
 const text=body.trim();
 if(!text||text.length>4000)throw new Error('invalid_message');
 const {data,error}=await socialSupabase.from('messages').insert({conversation_id:conversationId,sender_id:session.user.id,body:text,message_type:'text'}).select().single();
 if(error)throw error;
 return data;
}

export async function listNotifications(){
 const session=await requireSession();
 const {data,error}=await socialSupabase.from('notifications').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);
 if(error)throw error;
 return data||[];
}

export async function markNotificationRead(id:string){
 const session=await requireSession();
 const {error}=await socialSupabase.from('notifications').update({is_read:true}).eq('id',id).eq('user_id',session.user.id);
 if(error)throw error;
}

export function subscribeSocial(onChange:()=>void,userId?:string):RealtimeChannel{
 const channel=socialSupabase.channel(`zoriq-social-${userId||'public'}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'posts'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'comments'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'post_likes'},onChange);
 if(userId){
  channel.on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${userId}`},onChange)
   .on('postgres_changes',{event:'*',schema:'public',table:'user_follows'},onChange)
   .on('postgres_changes',{event:'*',schema:'public',table:'messages'},onChange)
   .on('postgres_changes',{event:'*',schema:'public',table:'xp_events',filter:`user_id=eq.${userId}`},onChange);
 }
 channel.subscribe();
 return channel;
}

export async function stopSocialSubscription(channel:RealtimeChannel){await socialSupabase.removeChannel(channel)}
