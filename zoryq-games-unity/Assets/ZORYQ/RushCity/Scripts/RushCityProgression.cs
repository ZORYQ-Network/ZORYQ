using System;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    [Serializable]
    public sealed class RushCityProgressionState
    {
        public string version="zoryq.rush.progress.v1";
        public int level=1;
        public int xp;
        public int runs;
        public int bestScore;
        public float bestDistance;
        public int totalGameplayZqCollected;
        public int missionsCompleted;
        public int worldEventsCompleted;
    }

    public sealed class RushCityProgression : MonoBehaviour
    {
        public static RushCityProgression Instance { get; private set; }
        const string Key="zoryq.rush.progress.v1";
        public RushCityProgressionState State { get; private set; }=new RushCityProgressionState();
        public int Level=>State.level;
        public int Xp=>State.xp;
        public int XpForNextLevel=>RequiredXp(State.level);

        void Awake()
        {
            if(Instance!=null&&Instance!=this){Destroy(gameObject);return;}
            Instance=this;
            Load();
        }

        void OnEnable()
        {
            RushCityGameEvents.ZqCollected+=OnZq;
            RushCityGameEvents.MissionCompleted+=OnMission;
            RushCityGameEvents.WorldEventRewarded+=OnWorldEventReward;
            RushCityGameEvents.RunEnded+=OnRunEnded;
        }

        void OnDisable()
        {
            RushCityGameEvents.ZqCollected-=OnZq;
            RushCityGameEvents.MissionCompleted-=OnMission;
            RushCityGameEvents.WorldEventRewarded-=OnWorldEventReward;
            RushCityGameEvents.RunEnded-=OnRunEnded;
        }

        void OnZq(int amount,int combo)
        {
            State.totalGameplayZqCollected+=Mathf.Max(0,amount);
            AddXp(Mathf.Max(1,amount*2));
        }

        void OnMission(int score,int zq,string mission)
        {
            State.missionsCompleted++;
            AddXp(45+Mathf.Clamp(score/80,0,90));
            Save();
        }

        void OnWorldEventReward(RushWorldEvent worldEvent,int score,int zq)
        {
            State.worldEventsCompleted++;
            AddXp(80+Mathf.Clamp(score/50,0,120));
            Save();
        }

        void OnRunEnded(string reason)
        {
            var gm=RushCityGameManager.Instance;if(!gm)return;
            State.runs++;
            State.bestScore=Mathf.Max(State.bestScore,gm.Score);
            State.bestDistance=Mathf.Max(State.bestDistance,gm.DistanceMeters);
            AddXp(Mathf.Clamp(Mathf.RoundToInt(gm.DistanceMeters/12f)+gm.Score/400,15,350));
            Save();
        }

        public void AddXp(int amount)
        {
            State.xp+=Mathf.Max(0,amount);
            while(State.xp>=RequiredXp(State.level))
            {
                State.xp-=RequiredXp(State.level);
                State.level=Mathf.Min(999,State.level+1);
            }
        }

        static int RequiredXp(int level)=>Mathf.RoundToInt(220f+Mathf.Pow(Mathf.Max(1,level),1.18f)*95f);

        void Load()
        {
            var json=PlayerPrefs.GetString(Key,string.Empty);
            if(string.IsNullOrEmpty(json))return;
            try
            {
                var parsed=JsonUtility.FromJson<RushCityProgressionState>(json);
                if(parsed!=null&&parsed.version=="zoryq.rush.progress.v1")State=parsed;
            }
            catch{State=new RushCityProgressionState();}
        }

        void Save()
        {
            PlayerPrefs.SetString(Key,JsonUtility.ToJson(State));
            PlayerPrefs.Save();
            Debug.Log($"[Rush City] progression level={State.level} xp={State.xp}/{XpForNextLevel} gameplay-only/client-untrusted");
        }
    }
}
