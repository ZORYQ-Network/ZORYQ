import {isAddress} from 'ethers';
import {socialSupabase} from './socialBackend';

export type SocialPaymentDestination={
 profile_id:string;
 address:string;
 chain_namespace:string;
 chain_id:string|null;
};

/**
 * Resolve the current receiving wallet at the last responsible moment.
 * The RPC only returns a destination when the profile owner enabled wallet
 * visibility and the EVM wallet was verified by the backend.
 */
export async function resolveSocialPaymentDestination(profileId:string):Promise<SocialPaymentDestination>{
 const {data:{session},error:sessionError}=await socialSupabase.auth.getSession();
 if(sessionError)throw sessionError;
 if(!session)throw new Error('auth_required');
 const {data,error}=await socialSupabase.rpc('social_payment_destination',{p_profile_id:profileId});
 if(error)throw error;
 const row=(Array.isArray(data)?data[0]:data) as SocialPaymentDestination|null|undefined;
 if(!row?.address||!isAddress(row.address)||row.chain_namespace!=='eip155')throw new Error('payment_destination_unavailable');
 return row;
}

export async function assertSocialPaymentDestination(profileId:string,displayedAddress:string):Promise<SocialPaymentDestination>{
 const current=await resolveSocialPaymentDestination(profileId);
 if(!isAddress(displayedAddress)||current.address.toLowerCase()!==displayedAddress.toLowerCase())throw new Error('payment_destination_changed');
 return current;
}
