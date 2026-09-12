const fs=require('fs');
const path=require('path');
const {withDangerousMod,withMainApplication,createRunOncePlugin}=require('expo/config-plugins');

function withApp(config){
  return withMainApplication(config,c=>{
    let src=c.modResults.contents;
    if(!src.includes('ZoryqGamePackage()')){
      src=src.replace('PackageList(this).packages.apply {','PackageList(this).packages.apply {\n          add(ZoryqGamePackage())');
    }
    c.modResults.contents=src;
    return c;
  });
}

const native=`package __PACKAGE__

import android.app.Activity
import android.content.Intent
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

private const val GAME_REQUEST_CODE=7421

class ZoryqGameModule(private val rc:ReactApplicationContext):ReactContextBaseJavaModule(rc),ActivityEventListener{
  private var pending:Promise?=null

  init{rc.addActivityEventListener(this)}

  override fun getName()="ZoryqGameBridge"

  private fun activityClass(gameId:String):String?=when(gameId){
    "rush-city"->"com.zoryq.games.RushCityActivity"
    "realm-rivals"->"com.zoryq.games.RealmRivalsActivity"
    "battle-zone-heroes"->"com.zoryq.games.BattleZoneHeroesActivity"
    "wallet-quest"->"com.zoryq.games.WalletQuestActivity"
    "tycoon-world"->"com.zoryq.games.TycoonWorldActivity"
    else->null
  }

  private fun intentFor(gameId:String,payload:String):Intent?{
    val cls=activityClass(gameId)?:return null
    val i=Intent().setClassName(rc.packageName,cls)
      .putExtra("zoryq_play_game_id",gameId)
      .putExtra("zoryq_play_launch",payload)
    return if(i.resolveActivity(rc.packageManager)!=null)i else null
  }

  @ReactMethod fun isAvailable(gameId:String,promise:Promise){
    try{promise.resolve(intentFor(gameId,"{}")!=null)}catch(e:Throwable){promise.reject("GAME_AVAILABILITY",e)}
  }

  @ReactMethod fun launch(gameId:String,payload:String,promise:Promise){
    try{
      if(pending!=null){promise.reject("GAME_BUSY","Another ZORYQ Play session is already active");return}
      val activity=currentActivity
      if(activity==null){promise.reject("GAME_ACTIVITY","Android activity unavailable");return}
      val intent=intentFor(gameId,payload)
      if(intent==null){promise.reject("GAME_ENGINE_UNAVAILABLE","Native game engine activity is not packaged for $gameId");return}
      pending=promise
      activity.startActivityForResult(intent,GAME_REQUEST_CODE)
    }catch(e:Throwable){pending=null;promise.reject("GAME_LAUNCH",e)}
  }

  override fun onActivityResult(activity:Activity?,requestCode:Int,resultCode:Int,data:Intent?){
    if(requestCode!=GAME_REQUEST_CODE)return
    val p=pending?:return
    pending=null
    if(resultCode!=Activity.RESULT_OK){p.resolve(null);return}
    p.resolve(data?.getStringExtra("zoryq_play_result"))
  }

  override fun onNewIntent(intent:Intent?){}
}

class ZoryqGamePackage:ReactPackage{
  override fun createNativeModules(reactContext:ReactApplicationContext):List<NativeModule> = listOf(ZoryqGameModule(reactContext))
  override fun createViewManagers(reactContext:ReactApplicationContext):List<ViewManager<*,*>> = emptyList()
}
`;

function withNative(config){
  return withDangerousMod(config,['android',async c=>{
    const pkg=c.android?.package||'com.zoryq.wallet';
    const root=c.modRequest.platformProjectRoot;
    const dir=path.join(root,'app','src','main','java',...pkg.split('.'));
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'ZoryqGameBridgeNative.kt'),native.replaceAll('__PACKAGE__',pkg));
    return c;
  }]);
}

function plugin(config){config=withApp(config);config=withNative(config);return config}
module.exports=createRunOncePlugin(plugin,'zoryq-game-bridge-native','1.0.0');
