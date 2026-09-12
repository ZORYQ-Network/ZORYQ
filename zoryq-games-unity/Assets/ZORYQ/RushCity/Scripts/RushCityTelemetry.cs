using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityTelemetry : MonoBehaviour
    {
        public static RushCityTelemetry Instance { get; private set; }
        public int laneChanges { get; private set; }
        public int jumps { get; private set; }
        public int slides { get; private set; }
        public int wallRuns { get; private set; }
        public int obstacleHits { get; private set; }
        public int nearMisses { get; private set; }
        public int worldEventsStarted { get; private set; }
        public int worldEventsCompleted { get; private set; }
        public int droneGauntletsCompleted { get; private set; }
        public int hyperTrainsCompleted { get; private set; }
        public int stormRushesCompleted { get; private set; }
        public float AverageFps => _frames>0 ? _fpsTotal/_frames : 0f;
        float _fpsTotal; int _frames;

        void Awake(){Instance=this;}
        void Update(){var dt=Mathf.Max(Time.unscaledDeltaTime,.0001f);_fpsTotal+=1f/dt;_frames++;}
        public void LaneChange()=>laneChanges++;
        public void Jump()=>jumps++;
        public void Slide()=>slides++;
        public void WallRun()=>wallRuns++;
        public void Hit()=>obstacleHits++;
        public void NearMiss()=>nearMisses++;
        public void WorldEventStarted(RushWorldEvent worldEvent){if(worldEvent!=RushWorldEvent.None)worldEventsStarted++;}
        public void WorldEventCompleted(RushWorldEvent worldEvent)
        {
            if(worldEvent==RushWorldEvent.None)return;
            worldEventsCompleted++;
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:droneGauntletsCompleted++;break;
                case RushWorldEvent.HyperTrain:hyperTrainsCompleted++;break;
                case RushWorldEvent.StormRush:stormRushesCompleted++;break;
            }
        }
        public string SnapshotJson()=>JsonUtility.ToJson(new Snapshot
        {
            laneChanges=laneChanges,jumps=jumps,slides=slides,wallRuns=wallRuns,obstacleHits=obstacleHits,nearMisses=nearMisses,
            worldEventsStarted=worldEventsStarted,worldEventsCompleted=worldEventsCompleted,droneGauntletsCompleted=droneGauntletsCompleted,
            hyperTrainsCompleted=hyperTrainsCompleted,stormRushesCompleted=stormRushesCompleted,averageFps=AverageFps
        });

        [System.Serializable]
        struct Snapshot
        {
            public int laneChanges,jumps,slides,wallRuns,obstacleHits,nearMisses;
            public int worldEventsStarted,worldEventsCompleted,droneGauntletsCompleted,hyperTrainsCompleted,stormRushesCompleted;
            public float averageFps;
        }
    }
}
