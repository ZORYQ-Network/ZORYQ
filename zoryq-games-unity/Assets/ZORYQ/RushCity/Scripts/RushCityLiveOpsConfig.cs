using System;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    [Serializable]
    public sealed class RushCitySeasonConfig
    {
        public string version="zoryq.rush.liveops.v1";
        public string seasonId="genesis-night";
        public string district="neo-downtown";
        public float speedMultiplier=1f;
        public float chaseMultiplier=1f;
        public float zqDensityMultiplier=1f;
        public bool ghostRaceEnabled=true;
        public bool stormEventEnabled=false;
        public bool doubleScoreWeekend=false;
        public string cosmeticTheme="electric-violet";

        public bool worldEventsEnabled=true;
        public bool droneGauntletEnabled=true;
        public bool hyperTrainEnabled=true;
        public bool stormRushEnabled=true;
        public float worldEventRewardMultiplier=1f;
    }

    public sealed class RushCityLiveOpsConfig : MonoBehaviour
    {
        public static RushCityLiveOpsConfig Instance { get; private set; }
        public RushCitySeasonConfig Current { get; private set; } = new RushCitySeasonConfig();
        const string LocalKey="zoryq.rush.liveops.cached.v1";

        void Awake()
        {
            Instance=this;
            var cached=PlayerPrefs.GetString(LocalKey,string.Empty);
            if(!string.IsNullOrEmpty(cached))ApplyJson(cached,false);
        }

        public bool ApplyJson(string json,bool persist=true)
        {
            if(string.IsNullOrWhiteSpace(json))return false;
            try
            {
                var parsed=JsonUtility.FromJson<RushCitySeasonConfig>(json);
                if(parsed==null||parsed.version!="zoryq.rush.liveops.v1"||string.IsNullOrEmpty(parsed.seasonId))return false;
                parsed.speedMultiplier=Mathf.Clamp(parsed.speedMultiplier,.85f,1.20f);
                parsed.chaseMultiplier=Mathf.Clamp(parsed.chaseMultiplier,.75f,1.35f);
                parsed.zqDensityMultiplier=Mathf.Clamp(parsed.zqDensityMultiplier,.65f,1.60f);
                parsed.worldEventRewardMultiplier=Mathf.Clamp(parsed.worldEventRewardMultiplier,.5f,2f);
                Current=parsed;
                if(persist){PlayerPrefs.SetString(LocalKey,JsonUtility.ToJson(Current));PlayerPrefs.Save();}
                Debug.Log($"[Rush City] LiveOps season={Current.seasonId} district={Current.district} worldEvents={Current.worldEventsEnabled}");
                return true;
            }
            catch{return false;}
        }

        public float Speed(float raw)=>raw*Current.speedMultiplier;
        public float Chase(float raw)=>raw*Current.chaseMultiplier;
        public int Score(int raw)=>Current.doubleScoreWeekend?raw*2:raw;
        public int WorldEventReward(int raw)=>Mathf.RoundToInt(raw*Current.worldEventRewardMultiplier);
    }
}
