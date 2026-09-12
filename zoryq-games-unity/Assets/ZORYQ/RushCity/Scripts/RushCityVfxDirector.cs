using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityVfxDirector : MonoBehaviour
    {
        [SerializeField] Transform player;
        ParticleSystem _speed,_impact,_zq,_power,_nearMiss,_worldBurst,_worldLoop;

        public void Configure(Transform runner){player=runner;}

        void Awake()
        {
            _speed=CreateBurst("SpeedBurst",new Color(.05f,.8f,1f,1f),.22f,7f,52,ParticleSystemShapeType.Cone);
            _impact=CreateBurst("ImpactBurst",new Color(1f,.08f,.22f,1f),.38f,8f,70,ParticleSystemShapeType.Sphere);
            _zq=CreateBurst("ZqBurst",new Color(.62f,.16f,1f,1f),.28f,4f,28,ParticleSystemShapeType.Sphere);
            _power=CreateBurst("PowerBurst",new Color(.1f,1f,.65f,1f),.5f,6f,80,ParticleSystemShapeType.Sphere);
            _nearMiss=CreateBurst("NearMissBurst",new Color(1f,.45f,.05f,1f),.18f,9f,38,ParticleSystemShapeType.Cone);
            _worldBurst=CreateBurst("WorldEventBurst",new Color(.75f,.15f,1f,1f),.55f,11f,110,ParticleSystemShapeType.Sphere);
            _worldLoop=CreateLoop("WorldEventAtmosphere",new Color(.25f,.6f,1f,.65f));
        }

        void OnEnable()
        {
            RushCityGameEvents.ZqCollected+=OnZq;
            RushCityGameEvents.NearMissed+=OnNearMiss;
            RushCityGameEvents.Impacted+=OnImpact;
            RushCityGameEvents.PowerUpActivated+=OnPower;
            RushCityGameEvents.WallRan+=OnWallRun;
            RushCityGameEvents.RouteChosen+=OnRoute;
            RushCityGameEvents.WorldEventChanged+=OnWorldEvent;
            RushCityGameEvents.WorldEventRewarded+=OnWorldEventReward;
        }

        void OnDisable()
        {
            RushCityGameEvents.ZqCollected-=OnZq;
            RushCityGameEvents.NearMissed-=OnNearMiss;
            RushCityGameEvents.Impacted-=OnImpact;
            RushCityGameEvents.PowerUpActivated-=OnPower;
            RushCityGameEvents.WallRan-=OnWallRun;
            RushCityGameEvents.RouteChosen-=OnRoute;
            RushCityGameEvents.WorldEventChanged-=OnWorldEvent;
            RushCityGameEvents.WorldEventRewarded-=OnWorldEventReward;
        }

        void LateUpdate()
        {
            if(!player)return;
            var anchor=player.position+Vector3.up*.85f;
            _speed.transform.position=anchor-Vector3.forward*.5f;
            _impact.transform.position=anchor;
            _zq.transform.position=anchor+Vector3.up*.25f;
            _power.transform.position=anchor;
            _nearMiss.transform.position=anchor;
            _worldBurst.transform.position=anchor;
            _worldLoop.transform.position=anchor+Vector3.forward*5f;

            var director=RushCityWorldEventDirector.Instance;
            var intensity=director?director.Intensity:0f;
            var emission=_worldLoop.emission;
            emission.rateOverTime=Mathf.Lerp(0f,85f,intensity);
            var main=_worldLoop.main;
            main.startSpeed=Mathf.Lerp(2f,9f,intensity);
        }

        ParticleSystem CreateBurst(string name,Color color,float lifetime,float speed,int particles,ParticleSystemShapeType shapeType)
        {
            var go=new GameObject(name);go.transform.SetParent(transform,false);
            var ps=go.AddComponent<ParticleSystem>();
            var main=ps.main;main.loop=false;main.playOnAwake=false;main.startLifetime=lifetime;main.startSpeed=speed;main.startSize=new ParticleSystem.MinMaxCurve(.05f,.18f);main.startColor=color;main.maxParticles=Mathf.Max(32,particles*2);main.simulationSpace=ParticleSystemSimulationSpace.World;
            var emission=ps.emission;emission.rateOverTime=0;emission.SetBursts(new[]{new ParticleSystem.Burst(0f,(short)particles)});
            var shape=ps.shape;shape.shapeType=shapeType;shape.radius=.32f;shape.angle=16f;
            var velocity=ps.velocityOverLifetime;velocity.enabled=true;velocity.z=new ParticleSystem.MinMaxCurve(-1.5f,-4f);
            var size=ps.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1f,AnimationCurve.EaseInOut(0,1,1,0));
            return ps;
        }

        ParticleSystem CreateLoop(string name,Color color)
        {
            var go=new GameObject(name);go.transform.SetParent(transform,false);
            var ps=go.AddComponent<ParticleSystem>();
            var main=ps.main;main.loop=true;main.playOnAwake=true;main.startLifetime=new ParticleSystem.MinMaxCurve(.35f,.8f);main.startSpeed=3f;main.startSize=new ParticleSystem.MinMaxCurve(.018f,.065f);main.startColor=color;main.maxParticles=280;main.simulationSpace=ParticleSystemSimulationSpace.World;
            var emission=ps.emission;emission.rateOverTime=0f;
            var shape=ps.shape;shape.shapeType=ParticleSystemShapeType.Box;shape.scale=new Vector3(13f,7f,12f);
            ps.Play();
            return ps;
        }

        void OnZq(int amount,int combo){_zq?.Play();if(combo>=5)_speed?.Play();}
        void OnNearMiss(){_nearMiss?.Play();_speed?.Play();}
        void OnImpact(float severity){_impact?.Play();}
        void OnPower(RushPowerUpType type,float duration){_power?.Play();if(type==RushPowerUpType.Overdrive)_speed?.Play();}
        void OnWallRun(){_speed?.Play();}
        void OnRoute(int direction,string district){_speed?.Play();_power?.Play();}

        void OnWorldEvent(RushWorldEvent worldEvent,bool active)
        {
            var color=EventColor(worldEvent);
            var burstMain=_worldBurst.main;burstMain.startColor=color;
            var loopMain=_worldLoop.main;loopMain.startColor=new Color(color.r,color.g,color.b,.62f);
            if(active){_worldBurst.Play();_speed.Play();}
            else _worldBurst.Play();
        }

        void OnWorldEventReward(RushWorldEvent worldEvent,int score,int zq)
        {
            var main=_worldBurst.main;main.startColor=new Color(.25f,1f,.55f,1f);_worldBurst.Play();_power.Play();
        }

        Color EventColor(RushWorldEvent worldEvent)
        {
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:return new Color(1f,.1f,.22f,1f);
                case RushWorldEvent.HyperTrain:return new Color(.05f,.9f,1f,1f);
                case RushWorldEvent.StormRush:return new Color(.68f,.18f,1f,1f);
                default:return Color.white;
            }
        }
    }
}
