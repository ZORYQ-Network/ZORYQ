import {socialSupabase} from './socialBackend';

export type ThemePreference='system'|'light'|'dark';
export type OwnProfilePreferences={avatar_url:string|null;show_wallet:boolean;theme_preference:ThemePreference};

async function requireUserId(){const {data,error}=await socialSupabase.auth.getSession();if(error)throw error;const id=data.session?.user.id;if(!id)throw new Error('auth_required');return id}

export async function getOwnProfilePreferences():Promise<OwnProfilePreferences>{
 const userId=await requireUserId();
 const {data,error}=await socialSupabase.from('profiles').select('avatar_url,show_wallet,theme_preference').eq('id',userId).single();
 if(error)throw error;
 return {avatar_url:data.avatar_url||null,show_wallet:Boolean(data.show_wallet),theme_preference:(data.theme_preference||'system') as ThemePreference};
}

export async function updateOwnProfilePreferences(input:Partial<OwnProfilePreferences>){
 const userId=await requireUserId();
 const payload={...input,updated_at:new Date().toISOString()};
 const {data,error}=await socialSupabase.from('profiles').update(payload).eq('id',userId).select('avatar_url,show_wallet,theme_preference').single();
 if(error)throw error;
 return data;
}

export async function uploadProfileAvatar(uri:string,mimeType='image/jpeg'){
 const userId=await requireUserId();
 const safeMime=['image/jpeg','image/png','image/webp'].includes(mimeType)?mimeType:'image/jpeg';
 const ext=safeMime==='image/png'?'png':safeMime==='image/webp'?'webp':'jpg';
 const body=await fetch(uri).then(r=>{if(!r.ok)throw new Error('avatar_read_failed');return r.arrayBuffer()});
 if(body.byteLength>5*1024*1024)throw new Error('avatar_too_large');
 const path=`${userId}/${Date.now()}.${ext}`;
 const {error}=await socialSupabase.storage.from('profile-media').upload(path,body,{contentType:safeMime,cacheControl:'31536000',upsert:false});
 if(error)throw error;
 const {data}=socialSupabase.storage.from('profile-media').getPublicUrl(path);
 const publicUrl=data.publicUrl;
 await updateOwnProfilePreferences({avatar_url:publicUrl});
 return publicUrl;
}
