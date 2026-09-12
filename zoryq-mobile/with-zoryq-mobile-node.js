const fs=require('fs');
const path=require('path');
const {withAndroidManifest,withDangerousMod,withMainApplication,createRunOncePlugin}=require('expo/config-plugins');

const SERVICE='ZoryqNodeService';
const RECEIVER='ZoryqNodeBootReceiver';

function addPermission(manifest,name){
  const key='uses-permission';
  manifest[key]=manifest[key]||[];
  if(!manifest[key].some(p=>p?.$?.['android:name']===name))manifest[key].push({$:{'android:name':name}});
}

function withManifest(config){
  return withAndroidManifest(config,c=>{
    const m=c.modResults.manifest;
    [
      'android.permission.INTERNET',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.POST_NOTIFICATIONS'
    ].forEach(p=>addPermission(m,p));
    const app=m.application?.[0];
    if(app){
      app.service=app.service||[];
      if(!app.service.some(x=>x?.$?.['android:name']===`.${SERVICE}`))app.service.push({
        $:{'android:name':`.${SERVICE}`,'android:enabled':'true','android:exported':'false','android:foregroundServiceType':'specialUse'},
        property:[{$:{'android:name':'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE','android:value':'Maintains user-enabled ZORYQ Testnet mobile node heartbeats and node health while the app is not visible.'}}]
      });
      app.receiver=app.receiver||[];
      if(!app.receiver.some(x=>x?.$?.['android:name']===`.${RECEIVER}`))app.receiver.push({
        $:{'android:name':`.${RECEIVER}`,'android:enabled':'true','android:exported':'false'},
        'intent-filter':[{
          action:[
            {$:{'android:name':'android.intent.action.BOOT_COMPLETED'}},
            {$:{'android:name':'android.intent.action.MY_PACKAGE_REPLACED'}}
          ]
        }]
      });
    }
    return c;
  });
}

function withApp(config){
  return withMainApplication(config,c=>{
    let src=c.modResults.contents;
    if(!src.includes('ZoryqNodePackage()')){
      src=src.replace('PackageList(this).packages.apply {','PackageList(this).packages.apply {\n          add(ZoryqNodePackage())');
    }
    c.modResults.contents=src;
    return c;
  });
}

const native=`package __PACKAGE__

import android.app.*
import android.content.*
import android.os.*
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val PREFS="zoryq_mobile_node_native_v1"
private const val CHANNEL="zoryq_mobile_node"
private const val NOTIFICATION_ID=5919065
private const val KEY_ALIAS="zoryq_mobile_node_secret_key_v1"

private object NodeCrypto {
  private fun key(): SecretKey {
    val ks=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
    val existing=ks.getKey(KEY_ALIAS,null) as? SecretKey
    if(existing!=null)return existing
    val kg=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore")
    kg.init(KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .build())
    return kg.generateKey()
  }
  fun encrypt(value:String):String{
    val c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key())
    val iv=Base64.encodeToString(c.iv,Base64.NO_WRAP)
    val ct=Base64.encodeToString(c.doFinal(value.toByteArray(StandardCharsets.UTF_8)),Base64.NO_WRAP)
    return "$iv:$ct"
  }
  fun decrypt(value:String):String{
    val parts=value.split(":",limit=2);require(parts.size==2)
    val iv=Base64.decode(parts[0],Base64.NO_WRAP);val ct=Base64.decode(parts[1],Base64.NO_WRAP)
    val c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,iv))
    return String(c.doFinal(ct),StandardCharsets.UTF_8)
  }
}

private fun Context.nodePrefs()=getSharedPreferences(PREFS,Context.MODE_PRIVATE)
private fun hmac(secret:String,message:String):String{
  val mac=Mac.getInstance("HmacSHA256")
  mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8),"HmacSHA256"))
  return mac.doFinal(message.toByteArray(StandardCharsets.UTF_8)).joinToString(""){String.format("%02x",it)}
}
private fun postJson(url:String,body:String):JSONObject{
  val conn=(URL(url).openConnection() as HttpURLConnection).apply{
    requestMethod="POST";connectTimeout=15000;readTimeout=15000;doOutput=true
    setRequestProperty("Content-Type","application/json")
  }
  conn.outputStream.use{it.write(body.toByteArray(StandardCharsets.UTF_8))}
  val code=conn.responseCode
  val stream=if(code in 200..299)conn.inputStream else conn.errorStream
  val text=stream?.use{BufferedReader(InputStreamReader(it)).readText()}?:"{}"
  conn.disconnect()
  val json=JSONObject(text)
  if(code !in 200..299)throw IllegalStateException(json.optString("error","HTTP $code"))
  return json
}

class ZoryqNodeService:Service(){
  companion object{
    const val ACTION_START="__PACKAGE__.NODE_START"
    const val ACTION_STOP="__PACKAGE__.NODE_STOP"
    fun start(context:Context){
      val i=Intent(context,ZoryqNodeService::class.java).setAction(ACTION_START)
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)context.startForegroundService(i) else context.startService(i)
    }
  }
  private val executor=Executors.newSingleThreadScheduledExecutor()
  private var task:ScheduledFuture<*>?=null
  override fun onBind(intent:Intent?)=null
  override fun onCreate(){super.onCreate();createChannel()}
  override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
    if(intent?.action==ACTION_STOP){nodePrefs().edit().putBoolean("enabled",false).apply();stopSelf();return START_NOT_STICKY}
    val p=nodePrefs();if(!p.getBoolean("enabled",false)){stopSelf();return START_NOT_STICKY}
    startForeground(NOTIFICATION_ID,notification("Iniciando Mobile Node…"))
    if(task==null||task?.isCancelled==true)task=executor.scheduleWithFixedDelay({runHeartbeat()},0,60,TimeUnit.SECONDS)
    return START_STICKY
  }
  private fun createChannel(){if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
    val n=getSystemService(NotificationManager::class.java);val ch=NotificationChannel(CHANNEL,"ZORIQ Mobile Node",NotificationManager.IMPORTANCE_LOW)
    ch.description="Mantém o Mobile Node da ZORYQ Testnet ativo";ch.setShowBadge(false);n.createNotificationChannel(ch)
  }}
  private fun notification(text:String):Notification{
    val launch=packageManager.getLaunchIntentForPackage(packageName)
    val pi=PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val b=if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)Notification.Builder(this,CHANNEL) else Notification.Builder(this)
    return b.setContentTitle("ZORIQ Mobile Node ativo").setContentText(text).setSmallIcon(android.R.drawable.stat_notify_sync_noanim).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(pi).build()
  }
  private fun updateNotification(text:String){(getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID,notification(text))}
  private fun runHeartbeat(){
    val p=nodePrefs()
    try{
      val nodeId=p.getString("nodeId",null)?:error("Node ID ausente")
      val enc=p.getString("secret",null)?:error("Node Secret ausente")
      val secret=NodeCrypto.decrypt(enc)
      val base=(p.getString("base",null)?:error("Endpoint ausente")).trimEnd('/')
      val rpc=JSONObject().put("jsonrpc","2.0").put("id",1).put("method","eth_blockNumber").put("params",org.json.JSONArray())
      val rpcResult=postJson("$base/rpc",rpc.toString())
      val hex=rpcResult.optString("result")
      val block=java.lang.Long.parseUnsignedLong(hex.removePrefix("0x"),16)
      val ts=System.currentTimeMillis()
      val mac=hmac(secret,"$nodeId:$ts:$block")
      val hb=JSONObject().put("nodeId",nodeId).put("timestamp",ts).put("block",block).put("mac",mac)
      val result=postJson("$base/validator/heartbeat",hb.toString())
      p.edit().putBoolean("healthy",result.optBoolean("healthy",false)).putLong("block",block)
        .putLong("heartbeatCount",result.optLong("heartbeatCount",0)).putLong("pendingPoints",result.optLong("pendingValidatorPointsEstimate",0))
        .putLong("lastHeartbeat",ts).putString("error","").apply()
      updateNotification("Bloco $block · ${result.optLong("heartbeatCount",0)} heartbeats")
    }catch(e:Throwable){p.edit().putBoolean("healthy",false).putString("error",e.message?:e.javaClass.simpleName).apply();updateNotification("Node degradado · toque para abrir")}
  }
  override fun onDestroy(){task?.cancel(false);executor.shutdownNow();super.onDestroy()}
}

class ZoryqNodeBootReceiver:BroadcastReceiver(){
  override fun onReceive(context:Context,intent:Intent){
    if(intent.action==Intent.ACTION_BOOT_COMPLETED||intent.action==Intent.ACTION_MY_PACKAGE_REPLACED){
      if(context.nodePrefs().getBoolean("enabled",false))runCatching{ZoryqNodeService.start(context)}
    }
  }
}

class ZoryqNodeModule(private val rc:ReactApplicationContext):ReactContextBaseJavaModule(rc){
  override fun getName()="ZoryqNodeService"
  @ReactMethod fun configure(nodeId:String,secret:String,operator:String,base:String,promise:Promise){try{
    rc.nodePrefs().edit().putString("nodeId",nodeId).putString("secret",NodeCrypto.encrypt(secret)).putString("operator",operator).putString("base",base.trimEnd('/')).putBoolean("configured",true).apply();promise.resolve(true)
  }catch(e:Throwable){promise.reject("NODE_CONFIG",e)}}
  @ReactMethod fun start(promise:Promise){try{
    val p=rc.nodePrefs();if(!p.getBoolean("configured",false))error("Mobile Node não configurado")
    p.edit().putBoolean("enabled",true).apply();ZoryqNodeService.start(rc);promise.resolve(true)
  }catch(e:Throwable){promise.reject("NODE_START",e)}}
  @ReactMethod fun stop(promise:Promise){try{
    rc.nodePrefs().edit().putBoolean("enabled",false).apply();rc.stopService(Intent(rc,ZoryqNodeService::class.java));promise.resolve(true)
  }catch(e:Throwable){promise.reject("NODE_STOP",e)}}
  @ReactMethod fun clear(promise:Promise){try{rc.nodePrefs().edit().clear().apply();rc.stopService(Intent(rc,ZoryqNodeService::class.java));promise.resolve(true)}catch(e:Throwable){promise.reject("NODE_CLEAR",e)}}
  @ReactMethod fun status(promise:Promise){try{
    val p=rc.nodePrefs();val m=Arguments.createMap();m.putBoolean("paired",p.getBoolean("configured",false));m.putBoolean("running",p.getBoolean("enabled",false));m.putBoolean("healthy",p.getBoolean("healthy",false));m.putString("nodeId",p.getString("nodeId","")?:"");m.putString("operator",p.getString("operator","")?:"");m.putDouble("block",p.getLong("block",-1).toDouble());m.putDouble("heartbeatCount",p.getLong("heartbeatCount",0).toDouble());m.putDouble("pendingPoints",p.getLong("pendingPoints",0).toDouble());m.putDouble("lastHeartbeat",p.getLong("lastHeartbeat",0).toDouble());m.putString("error",p.getString("error","")?:"");promise.resolve(m)
  }catch(e:Throwable){promise.reject("NODE_STATUS",e)}}
  @ReactMethod fun openBatterySettings(){try{rc.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}catch(_:Throwable){}}
  @ReactMethod fun openNotificationSettings(){try{rc.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,rc.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}catch(_:Throwable){}}
}

class ZoryqNodePackage:ReactPackage{
  override fun createNativeModules(reactContext:ReactApplicationContext):List<NativeModule> = listOf(ZoryqNodeModule(reactContext))
  override fun createViewManagers(reactContext:ReactApplicationContext):List<ViewManager<*,*>> = emptyList()
}
`;

function withNative(config){
  return withDangerousMod(config,['android',async c=>{
    const pkg=c.android?.package||'com.zoryq.wallet';
    const root=c.modRequest.platformProjectRoot;
    const dir=path.join(root,'app','src','main','java',...pkg.split('.'));
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'ZoryqNodeNative.kt'),native.replaceAll('__PACKAGE__',pkg));
    return c;
  }]);
}

function plugin(config){config=withManifest(config);config=withApp(config);config=withNative(config);return config}
module.exports=createRunOncePlugin(plugin,'zoryq-mobile-node-native','1.0.0');
