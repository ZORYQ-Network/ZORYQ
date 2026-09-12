using System;
using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushWorldEvent { None, DroneGauntlet, HyperTrain, StormRush }

    public sealed class RushCityWorldEventDirector : MonoBehaviour
    {
        public static RushCityWorldEventDirector Instance { get; private set; }

        [Header("Scheduling")]
        [SerializeField] float firstEventMeters=620f;
        [SerializeField] float minGapMeters=520f;
        [SerializeField] float maxGapMeters=860f;
        [SerializeField] float minDuration=11f;
        [SerializeField] float maxDuration=18f;

        public RushWorldEvent ActiveEvent { get; private set; }
        public float Intensity { get; private set; }
        public float SpeedMultiplier { get; private set; }=1f;
        public float ChaseMultiplier { get; private set; }=1f;
        public float ScoreMultiplier { get; private set; }=1f;
        public bool StormActive => ActiveEvent==RushWorldEvent.StormRush;
        public float RemainingSeconds => ActiveEvent==RushWorldEvent.None ? 0f : Mathf.Max(0f,_endAt-Time.time);
        public float Progress => ActiveEvent==RushWorldEvent.None ? 0f : Mathf.Clamp01((Time.time-_startedAt)/Mathf.Max(.1f,_duration));

        float _nextDistance;
        float _startedAt;
        float _duration;
        float _endAt;
        System.Random _rng;

        void Awake()
        {
            if(Instance!=null&&Instance!=this){Destroy(gameObject);return;}
            Instance=this;
        }

        void Start()
        {
            var seed=RushCityGameManager.Instance?.SessionId?.GetHashCode()??Environment.TickCount;
            _rng=new System.Random(seed);
            _nextDistance=firstEventMeters;
        }

        void Update()
        {
            var gm=RushCityGameManager.Instance;
            if(!gm||!gm.IsRunning)return;

            var live=RushCityLiveOpsConfig.Instance;
            if(live&&!live.Current.worldEventsEnabled)
            {
                if(ActiveEvent!=RushWorldEvent.None)CancelActiveEvent();
                return;
            }

            if(ActiveEvent==RushWorldEvent.None)
            {
                Intensity=0f;
                if(gm.DistanceMeters>=_nextDistance)BeginRandomEvent();
                return;
            }

            var enter=Mathf.Clamp01((Time.time-_startedAt)/1.6f);
            var exit=Mathf.Clamp01((_endAt-Time.time)/1.8f);
            Intensity=Mathf.Min(enter,exit);
            if(Time.time>=_endAt)CompleteEvent();
        }

        public bool ForceEvent(RushWorldEvent worldEvent,float duration=12f)
        {
            if(worldEvent==RushWorldEvent.None||ActiveEvent!=RushWorldEvent.None)return false;
            BeginEvent(worldEvent,Mathf.Clamp(duration,5f,45f));
            return true;
        }

        void BeginRandomEvent()
        {
            var enabled=EnabledEvents();
            if(enabled.Count==0)
            {
                _nextDistance=(RushCityGameManager.Instance?.DistanceMeters??0f)+maxGapMeters;
                return;
            }
            var selected=enabled[_rng.Next(0,enabled.Count)];
            var duration=Mathf.Lerp(minDuration,maxDuration,(float)_rng.NextDouble());
            BeginEvent(selected,duration);
        }

        List<RushWorldEvent> EnabledEvents()
        {
            var result=new List<RushWorldEvent>(3);
            var live=RushCityLiveOpsConfig.Instance;
            if(!live)
            {
                result.Add(RushWorldEvent.DroneGauntlet);
                result.Add(RushWorldEvent.HyperTrain);
                result.Add(RushWorldEvent.StormRush);
                return result;
            }
            if(live.Current.droneGauntletEnabled)result.Add(RushWorldEvent.DroneGauntlet);
            if(live.Current.hyperTrainEnabled)result.Add(RushWorldEvent.HyperTrain);
            if(live.Current.stormRushEnabled)result.Add(RushWorldEvent.StormRush);
            return result;
        }

        void BeginEvent(RushWorldEvent worldEvent,float duration)
        {
            ActiveEvent=worldEvent;
            _duration=duration;
            _startedAt=Time.time;
            _endAt=_startedAt+_duration;
            ApplyMultipliers(worldEvent);
            RushCityTelemetry.Instance?.WorldEventStarted(worldEvent);
            RushCityGameEvents.RaiseWorldEvent(worldEvent,true);
            Debug.Log($"[Rush City] world event START {worldEvent} duration={duration:0.0}s");
        }

        void ApplyMultipliers(RushWorldEvent worldEvent)
        {
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:
                    SpeedMultiplier=1.04f; ChaseMultiplier=1.45f; ScoreMultiplier=1.35f; break;
                case RushWorldEvent.HyperTrain:
                    SpeedMultiplier=1.18f; ChaseMultiplier=.82f; ScoreMultiplier=1.25f; break;
                case RushWorldEvent.StormRush:
                    SpeedMultiplier=1.09f; ChaseMultiplier=1.20f; ScoreMultiplier=1.45f; break;
                default:
                    SpeedMultiplier=ChaseMultiplier=ScoreMultiplier=1f; break;
            }
        }

        void CompleteEvent()
        {
            var completed=ActiveEvent;
            var gm=RushCityGameManager.Instance;
            var live=RushCityLiveOpsConfig.Instance;
            var rewardScore=EventScoreReward(completed);
            var rewardZq=EventZqReward(completed);
            if(live)
            {
                rewardScore=live.WorldEventReward(rewardScore);
                rewardZq=live.WorldEventReward(rewardZq);
            }

            ActiveEvent=RushWorldEvent.None;
            Intensity=0f;
            SpeedMultiplier=ChaseMultiplier=ScoreMultiplier=1f;

            if(gm)gm.GrantWorldEventReward(rewardScore,rewardZq,completed.ToString());
            RushCityTelemetry.Instance?.WorldEventCompleted(completed);
            RushCityGameEvents.RaiseWorldEvent(completed,false);
            _nextDistance=(gm?gm.DistanceMeters:0f)+Mathf.Lerp(minGapMeters,maxGapMeters,(float)_rng.NextDouble());
            Debug.Log($"[Rush City] world event COMPLETE {completed} +{rewardScore} score +{rewardZq} ZQ next={_nextDistance:0}m");
        }

        void CancelActiveEvent()
        {
            var cancelled=ActiveEvent;
            ActiveEvent=RushWorldEvent.None;
            Intensity=0f;
            SpeedMultiplier=ChaseMultiplier=ScoreMultiplier=1f;
            RushCityGameEvents.RaiseWorldEvent(cancelled,false);
        }

        int EventScoreReward(RushWorldEvent worldEvent)
        {
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:return 1100;
                case RushWorldEvent.HyperTrain:return 950;
                case RushWorldEvent.StormRush:return 1250;
                default:return 0;
            }
        }

        int EventZqReward(RushWorldEvent worldEvent)
        {
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:return 6;
                case RushWorldEvent.HyperTrain:return 5;
                case RushWorldEvent.StormRush:return 7;
                default:return 0;
            }
        }
    }
}
