using System;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushRunMode { Standard, Daily, Ghost }

    [Serializable]
    sealed class RushLaunchPayload
    {
        public string version;
        public string gameId;
        public string playerId;
        public string displayName;
        public string mode;
    }

    public sealed class RushCityRunModeDirector : MonoBehaviour
    {
        public static RushCityRunModeDirector Instance { get; private set; }
        const string ModeKey="zoryq.rush.mode.v1";
        const string DailyBestKey="zoryq.rush.daily.best.v1";
        const string DailyBestIdKey="zoryq.rush.daily.bestId.v1";

        public RushRunMode Mode { get; private set; }=RushRunMode.Standard;
        public string DailyId { get; private set; }
        public int TrackSeed { get; private set; }=42042;
        public int DailyBestScore { get; private set; }

        void Awake()
        {
            if(Instance!=null&&Instance!=this){Destroy(gameObject);return;}
            Instance=this;
            ResolveMode();
            ResolveSeed();
            LoadDailyBest();
        }

        void OnEnable(){RushCityGameEvents.RunEnded+=OnRunEnded;}
        void OnDisable(){RushCityGameEvents.RunEnded-=OnRunEnded;}

        public void SetMode(RushRunMode mode,bool persist=true)
        {
            Mode=mode;
            ResolveSeed();
            if(persist){PlayerPrefs.SetString(ModeKey,mode.ToString().ToLowerInvariant());PlayerPrefs.Save();}
        }

        public void ApplyToTrack(RushCityTrackManager track)
        {
            if(track)track.seed=TrackSeed;
        }

        void ResolveMode()
        {
            var requested=ReadAndroidLaunchMode();
            if(string.IsNullOrEmpty(requested))requested=PlayerPrefs.GetString(ModeKey,"standard");
            switch(requested.ToLowerInvariant())
            {
                case "daily":Mode=RushRunMode.Daily;break;
                case "ghost":Mode=RushRunMode.Ghost;break;
                default:Mode=RushRunMode.Standard;break;
            }
        }

        void ResolveSeed()
        {
            DailyId=DateTime.UtcNow.ToString("yyyy-MM-dd");
            switch(Mode)
            {
                case RushRunMode.Daily:TrackSeed=StableHash("zoryq-rush-daily:"+DailyId);break;
                case RushRunMode.Ghost:TrackSeed=StableHash("zoryq-rush-ghost:"+DailyId);break;
                default:TrackSeed=42042 ^ Environment.TickCount;break;
            }
        }

        void LoadDailyBest()
        {
            if(PlayerPrefs.GetString(DailyBestIdKey,string.Empty)!=DailyId){DailyBestScore=0;return;}
            DailyBestScore=PlayerPrefs.GetInt(DailyBestKey,0);
        }

        void OnRunEnded(string reason)
        {
            if(Mode!=RushRunMode.Daily)return;
            var gm=RushCityGameManager.Instance;if(!gm)return;
            if(gm.Score<=DailyBestScore)return;
            DailyBestScore=gm.Score;
            PlayerPrefs.SetString(DailyBestIdKey,DailyId);
            PlayerPrefs.SetInt(DailyBestKey,DailyBestScore);
            PlayerPrefs.Save();
            Debug.Log($"[Rush City] daily personal best {DailyId}: {DailyBestScore} (client-untrusted)");
        }

        string ReadAndroidLaunchMode()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var unityPlayer=new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var activity=unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent=activity.Call<AndroidJavaObject>("getIntent");
                var json=intent.Call<string>("getStringExtra","zoryq_play_launch");
                if(string.IsNullOrEmpty(json))return string.Empty;
                var payload=JsonUtility.FromJson<RushLaunchPayload>(json);
                if(payload==null||payload.version!="zoryq.play.launch.v1"||payload.gameId!="rush-city")return string.Empty;
                return payload.mode??string.Empty;
            }
            catch{return string.Empty;}
#else
            return string.Empty;
#endif
        }

        static int StableHash(string value)
        {
            unchecked
            {
                uint hash=2166136261;
                for(var i=0;i<value.Length;i++){hash^=value[i];hash*=16777619;}
                return (int)hash;
            }
        }
    }
}
