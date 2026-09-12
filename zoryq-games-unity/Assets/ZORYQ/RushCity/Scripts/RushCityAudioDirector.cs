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

        [Header("Loops")]
        [SerializeField] AudioClip windLoop;
        [SerializeField] AudioClip chaseLoop;

        AudioSource _oneShot;
        AudioSource _wind;
        AudioSource _chase;

        void Awake()
        {
            _oneShot=MakeSource("OneShots",false);
            _wind=MakeSource("Wind",true);_wind.clip=windLoop;
            _chase=MakeSource("Chase",true);_chase.clip=chaseLoop;
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
        }

        void Update()
        {
            var gm=RushCityGameManager.Instance;if(!gm)return;
            var speed=Mathf.InverseLerp(10f,38f,gm.CurrentSpeed);
            if(_wind){_wind.volume=Mathf.Lerp(.12f,.72f,speed);_wind.pitch=Mathf.Lerp(.82f,1.28f,speed);}
            if(_chase){_chase.volume=Mathf.Lerp(0f,.68f,gm.ChasePressure);_chase.pitch=Mathf.Lerp(.85f,1.18f,gm.ChasePressure);}
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
    }
}
