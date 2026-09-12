using System;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushWorldEvent { None, DroneGauntlet, HyperTrain, StormRush }

    public sealed class RushCityWorldEventDirector : MonoBehaviour
    {
        public static RushCityWorldEventDirector Instance { get; private set; }
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

        float _nextDistance;
        float _endAt;
        System.Random _rng;

        void Awake(){Instance=this;}
        void Start()
        {
            var seed=RushCityGameManager.Instance?.SessionId?.GetHashCode()??Environment.TickCount;
            _rng=new System.Random(seed);
            _nextDistance=firstEventMeters;
        }

        void Update()
        {
            var gm=RushCityGameManager.Instance;if(!gm||!gm.IsRunning)return;
            if(ActiveEvent==RushWorldEvent.None)
            {
                Intensity=0f;
                if(gm.DistanceMeters>=_nextDistance)BeginEvent();
                return;
            }

            var remaining=Mathf.Max(0f,_endAt-Time.time);
            var duration=Mathf.Max(.1f,maxDuration);
            var ramp=Mathf.Min(1f,(duration-remaining)/2f);
            var exit=Mathf.Min(1f,remaining/2f);
            Intensity=Mathf.Clamp01(Mathf.Min(ramp,exit));
            if(Time.time>=_endAt)CompleteEvent();
        }

        void BeginEvent()
        {
            var pick=_rng.Next(0,3);
            ActiveEvent=(RushWorldEvent)(pick+1);
            var duration=Mathf.Lerp(minDuration,maxDuration,(float)_rng.NextDouble());
            _endAt=Time.time+duration;
            switch(ActiveEvent)
            {
                case RushWorldEvent.DroneGauntlet:SpeedMultiplier=1.04f;ChaseMultiplier=1.45f;ScoreMultiplier=1.35f;break;
                case RushWorldEvent.HyperTrain:SpeedMultiplier=1.18f;ChaseMultiplier=.82f;ScoreMultiplier=1.25f;break;
                case RushWorldEvent.StormRush:SpeedMultiplier=1.09f;ChaseMultiplier=1.20f;ScoreMultiplier=1.45f;break;
            }
            RushCityGameEvents.RaiseWorldEvent(ActiveEvent,true);
            Debug.Log($"[Rush City] world event START {ActiveEvent} duration={duration:0.0}s");
        }

        void CompleteEvent()
        {
            var completed=ActiveEvent;
            ActiveEvent=RushWorldEvent.None;Intensity=0f;SpeedMultiplier=ChaseMultiplier=ScoreMultiplier=1f;
            var gm=RushCityGameManager.Instance;
            if(gm)gm.GrantWorldEventReward(900,5,completed.ToString());
            RushCityGameEvents.RaiseWorldEvent(completed,false);
            _nextDistance=(gm?gm.DistanceMeters:0f)+Mathf.Lerp(minGapMeters,maxGapMeters,(float)_rng.NextDouble());
            Debug.Log($"[Rush City] world event COMPLETE {completed} next={_nextDistance:0}m");
        }
    }
}
