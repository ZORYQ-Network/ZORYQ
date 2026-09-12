using System;

namespace Zoryq.Play.RushCity
{
    public static class RushCityGameEvents
    {
        public static event Action<int> LaneChanged;
        public static event Action Jumped;
        public static event Action Slid;
        public static event Action WallRan;
        public static event Action<int,int> ZqCollected;
        public static event Action NearMissed;
        public static event Action<float> Impacted;
        public static event Action<RushPowerUpType,float> PowerUpActivated;
        public static event Action<int,string> RouteChosen;
        public static event Action<int,int,string> MissionCompleted;
        public static event Action<RushWorldEvent,bool> WorldEventChanged;
        public static event Action<RushWorldEvent,int,int> WorldEventRewarded;
        public static event Action<string> RunEnded;

        public static void RaiseLaneChange(int lane)=>LaneChanged?.Invoke(lane);
        public static void RaiseJump()=>Jumped?.Invoke();
        public static void RaiseSlide()=>Slid?.Invoke();
        public static void RaiseWallRun()=>WallRan?.Invoke();
        public static void RaiseZq(int amount,int combo)=>ZqCollected?.Invoke(amount,combo);
        public static void RaiseNearMiss()=>NearMissed?.Invoke();
        public static void RaiseImpact(float severity)=>Impacted?.Invoke(severity);
        public static void RaisePowerUp(RushPowerUpType type,float duration)=>PowerUpActivated?.Invoke(type,duration);
        public static void RaiseRoute(int direction,string district)=>RouteChosen?.Invoke(direction,district);
        public static void RaiseMission(int score,int zq,string mission)=>MissionCompleted?.Invoke(score,zq,mission);
        public static void RaiseWorldEvent(RushWorldEvent worldEvent,bool active)=>WorldEventChanged?.Invoke(worldEvent,active);
        public static void RaiseWorldEventReward(RushWorldEvent worldEvent,int score,int zq)=>WorldEventRewarded?.Invoke(worldEvent,score,zq);
        public static void RaiseRunEnded(string reason)=>RunEnded?.Invoke(reason);
    }
}
