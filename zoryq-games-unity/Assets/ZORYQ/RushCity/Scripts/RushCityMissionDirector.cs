using System;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushMissionType { Distance, Zq, Parkour, NearMiss, Survival }

    [Serializable]
    public sealed class RushMission
    {
        public RushMissionType type;
        public int goal;
        public int progress;
        public int rewardScore;
        public int rewardZq;
        public bool completed;
    }

    public sealed class RushCityMissionDirector : MonoBehaviour
    {
        public static RushCityMissionDirector Instance { get; private set; }
        public RushMission[] Active { get; private set; } = new RushMission[3];

        void Awake(){Instance=this;}

        public void BeginSession(string sessionId)
        {
            var seed = string.IsNullOrEmpty(sessionId) ? Environment.TickCount : sessionId.GetHashCode();
            var rng = new System.Random(seed);
            Active[0] = Make((RushMissionType)rng.Next(0,3), rng);
            Active[1] = Make((RushMissionType)rng.Next(1,5), rng);
            Active[2] = Make(RushMissionType.Survival, rng);
        }

        RushMission Make(RushMissionType type,System.Random rng)
        {
            int goal = type == RushMissionType.Distance ? rng.Next(700,1600) : type == RushMissionType.Zq ? rng.Next(18,42) : type == RushMissionType.Survival ? rng.Next(45,100) : rng.Next(3,8);
            return new RushMission{type=type,goal=goal,rewardScore=500+goal*2,rewardZq=Mathf.Clamp(goal/12,2,15)};
        }

        public void OnDistance(float meters) => SetAbsolute(RushMissionType.Distance, Mathf.FloorToInt(meters));
        public void OnZq(int amount) => Add(RushMissionType.Zq, amount);
        public void OnParkour() => Add(RushMissionType.Parkour, 1);
        public void OnNearMiss() => Add(RushMissionType.NearMiss, 1);
        public void OnSurvival(float seconds) => SetAbsolute(RushMissionType.Survival, Mathf.FloorToInt(seconds));

        void Add(RushMissionType type,int amount)
        {
            foreach(var m in Active) if(m!=null && m.type==type && !m.completed){m.progress+=amount;Check(m);}
        }
        void SetAbsolute(RushMissionType type,int value)
        {
            foreach(var m in Active) if(m!=null && m.type==type && !m.completed){m.progress=Mathf.Max(m.progress,value);Check(m);}
        }
        void Check(RushMission m)
        {
            if(m.completed||m.progress<m.goal)return;
            m.completed=true;
            RushCityGameManager.Instance?.GrantMissionReward(m.rewardScore,m.rewardZq,m.type.ToString());
        }
    }
}
