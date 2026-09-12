using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityAudioDirector : MonoBehaviour
    {
        [Header("One shots")]
        [SerializeField] AudioClip jump;
        [SerializeField] AudioClip slide;
        [SerializeField] AudioClip wallRun;
        [SerializeField] AudioClip zq;
        [SerializeField] AudioClip nearMiss;
        [SerializeField] AudioClip impact;
        [SerializeField] AudioClip powerUp;
        [SerializeField] AudioClip route;
        [SerializeField] AudioClip mission;
        [SerializeField] AudioClip worldEventAlert;
        [SerializeField] AudioClip worldEventComplete;

        [Header("Loops")]
        [SerializeField] AudioClip windLoop;
        [SerializeField] AudioClip chaseLoop;
        [SerializeField] AudioClip droneGauntletLoop;
        [SerializeField] AudioClip hyperTrainLoop;
        [SerializeField] AudioClip stormRushLoop;

        AudioSource _oneShot;
        AudioSource _wind;
        AudioSource _chase;
        AudioSource _world;

        void Awake()
        {
            _oneShot=MakeSource("OneShots",false);
            _wind=MakeSource("Wind",true);_wind.clip=windLoop;
            _chase=MakeSource("Chase",true);_chase.clip=chaseLoop;
            _world=MakeSource("WorldEvent",true);
            if(windLoop)_wind.Play();
            if(chaseLoop)_chase.Play();
        }

        AudioSource MakeSource(string name,bool loop)
        {
            var go=new GameObject(name);go.transform.SetParent(transform);
            var s=go.AddComponent<AudioSource>();s.playOnAwake=false;s.loop=loop;s.spatialBlend=0f;return s;
        }

        void OnEnable()
        {
            RushCityGameEvents.Jumped+=OnJump;
            RushCityGameEvents.Slid+=OnSlide;
            RushCityGameEvents.WallRan+=OnWallRun;
            RushCityGameEvents.ZqCollected+=OnZq;
            RushCityGameEvents.NearMissed+=OnNearMiss;
            RushCityGameEvents.Impacted+=OnImpact;
            RushCityGameEvents.PowerUpActivated+=OnPower;
            RushCityGameEvents.RouteChosen+=OnRoute;
            RushCityGameEvents.MissionCompleted+=OnMission;
            RushCityGameEvents.WorldEventChanged+=OnWorldEvent;
            RushCityGameEvents.WorldEventRewarded+=OnWorldEventReward;
        }

        void OnDisable()
        {
            RushCityGameEvents.Jumped-=OnJump;
            RushCityGameEvents.Slid-=OnSlide;
            RushCityGameEvents.WallRan-=OnWallRun;
            RushCityGameEvents.ZqCollected-=OnZq;
            RushCityGameEvents.NearMissed-=OnNearMiss;
            RushCityGameEvents.Impacted-=OnImpact;
            RushCityGameEvents.PowerUpActivated-=OnPower;
            RushCityGameEvents.RouteChosen-=OnRoute;
            RushCityGameEvents.MissionCompleted-=OnMission;
            RushCityGameEvents.WorldEventChanged-=OnWorldEvent;
            RushCityGameEvents.WorldEventRewarded-=OnWorldEventReward;
        }

        void Update()
        {
            var gm=RushCityGameManager.Instance;if(!gm)return;
            var speed=Mathf.InverseLerp(10f,38f,gm.CurrentSpeed);
            var eventIntensity=RushCityWorldEventDirector.Instance?RushCityWorldEventDirector.Instance.Intensity:0f;
            if(_wind){_wind.volume=Mathf.Lerp(.12f,.72f,speed)*(1f-eventIntensity*.25f);_wind.pitch=Mathf.Lerp(.82f,1.28f,speed);}
            if(_chase){_chase.volume=Mathf.Lerp(0f,.68f,gm.ChasePressure)*(1f-eventIntensity*.18f);_chase.pitch=Mathf.Lerp(.85f,1.18f,gm.ChasePressure);}
            if(_world)
            {
                var target=eventIntensity>0f?.78f:0f;
                _world.volume=Mathf.MoveTowards(_world.volume,target,Time.unscaledDeltaTime*1.8f);
                _world.pitch=Mathf.Lerp(.94f,1.12f,eventIntensity);
                if(_world.clip&&eventIntensity>0f&&!_world.isPlaying)_world.Play();
                if(eventIntensity<=0f&&_world.isPlaying&&_world.volume<=.01f)_world.Stop();
            }
        }

        void Play(AudioClip clip,float volume=1f,float pitch=1f){if(!_oneShot||!clip)return;_oneShot.pitch=pitch;_oneShot.PlayOneShot(clip,volume);}
        void OnJump()=>Play(jump,.82f);
        void OnSlide()=>Play(slide,.76f);
        void OnWallRun()=>Play(wallRun,.85f);
        void OnNearMiss()=>Play(nearMiss,.92f);
        void OnZq(int amount,int combo)=>Play(zq,Mathf.Lerp(.45f,.9f,combo/10f),Mathf.Lerp(.95f,1.35f,combo/10f));
        void OnImpact(float severity)=>Play(impact,Mathf.Lerp(.5f,1f,severity),Mathf.Lerp(1.1f,.82f,severity));
        void OnPower(RushPowerUpType type,float duration)=>Play(powerUp,.9f,type==RushPowerUpType.Overdrive?1.25f:1f);
        void OnRoute(int direction,string district)=>Play(route,.85f,direction<0?.96f:1.04f);
        void OnMission(int score,int zqReward,string mission)=>Play(mission,1f,1.08f);

        void OnWorldEvent(RushWorldEvent worldEvent,bool active)
        {
            if(active)
            {
                if(_world)
                {
                    _world.Stop();
                    _world.clip=ClipFor(worldEvent);
                    _world.volume=0f;
                    if(_world.clip)_world.Play();
                }
                Play(worldEventAlert,1f,worldEvent==RushWorldEvent.HyperTrain?1.08f:.96f);
            }
            else if(_world)_world.volume=Mathf.Min(_world.volume,.25f);
        }

        void OnWorldEventReward(RushWorldEvent worldEvent,int score,int zqReward)=>Play(worldEventComplete,1f,1.12f);

        AudioClip ClipFor(RushWorldEvent worldEvent)
        {
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:return droneGauntletLoop;
                case RushWorldEvent.HyperTrain:return hyperTrainLoop;
                case RushWorldEvent.StormRush:return stormRushLoop;
                default:return null;
            }
        }
    }
}
