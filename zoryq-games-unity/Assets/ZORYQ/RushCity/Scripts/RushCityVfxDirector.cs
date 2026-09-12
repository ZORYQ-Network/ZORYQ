using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityVfxDirector : MonoBehaviour
    {
        [SerializeField] Transform player;
        ParticleSystem _speed,_impact,_zq,_power,_nearMiss;

        public void Configure(Transform runner){player=runner;}

        void Awake()
        {
            _speed=CreateBurst("SpeedBurst",new Color(.05f,.8f,1f,1f),.22f,7f,52,ParticleSystemShapeType.Cone);
            _impact=CreateBurst("ImpactBurst",new Color(1f,.08f,.22f,1f),.38f,8f,70,ParticleSystemShapeType.Sphere);
            _zq=CreateBurst("ZqBurst",new Color(.62f,.16f,1f,1f),.28f,4f,28,ParticleSystemShapeType.Sphere);
            _power=CreateBurst("PowerBurst",new Color(.1f,1f,.65f,1f),.5f,6f,80,ParticleSystemShapeType.Sphere);
            _nearMiss=CreateBurst("NearMissBurst",new Color(1f,.45f,.05f,1f),.18f,9f,38,ParticleSystemShapeType.Cone);
        }

        void OnEnable()
        {
            RushCityGameEvents.ZqCollected+=OnZq;
            RushCityGameEvents.NearMissed+=OnNearMiss;
            RushCityGameEvents.Impacted+=OnImpact;
            RushCityGameEvents.PowerUpActivated+=OnPower;
            RushCityGameEvents.WallRan+=OnWallRun;
            RushCityGameEvents.RouteChosen+=OnRoute;
        }

        void OnDisable()
        {
            RushCityGameEvents.ZqCollected-=OnZq;
            RushCityGameEvents.NearMissed-=OnNearMiss;
            RushCityGameEvents.Impacted-=OnImpact;
            RushCityGameEvents.PowerUpActivated-=OnPower;
            RushCityGameEvents.WallRan-=OnWallRun;
            RushCityGameEvents.RouteChosen-=OnRoute;
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

        void OnZq(int amount,int combo){_zq?.Play();if(combo>=5)_speed?.Play();}
        void OnNearMiss(){_nearMiss?.Play();_speed?.Play();}
        void OnImpact(float severity){_impact?.Play();}
        void OnPower(RushPowerUpType type,float duration){_power?.Play();if(type==RushPowerUpType.Overdrive)_speed?.Play();}
        void OnWallRun(){_speed?.Play();}
        void OnRoute(int direction,string district){_speed?.Play();_power?.Play();}
    }
}
