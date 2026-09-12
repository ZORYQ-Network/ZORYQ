using System;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityWorldEventGameplay : MonoBehaviour
    {
        [SerializeField] Transform player;
        [SerializeField] float laneWidth=2.65f;
        [SerializeField] float reactionSeconds=2.25f;
        [SerializeField] float minimumAhead=36f;
        [SerializeField] float maximumAhead=68f;

        RushWorldEvent _active;
        float _nextSpawnAt;
        System.Random _rng;
        Material _red,_cyan,_violet,_dark;

        public void Configure(Transform runner){player=runner;}

        void Awake()
        {
            _rng=new System.Random(Environment.TickCount);
            _red=Mat(new Color(1f,.04f,.15f),3.3f);
            _cyan=Mat(new Color(.04f,.88f,1f),3f);
            _violet=Mat(new Color(.65f,.12f,1f),3.4f);
            _dark=Mat(new Color(.025f,.03f,.055f),.35f);
        }

        void OnEnable(){RushCityGameEvents.WorldEventChanged+=OnWorldEvent;}
        void OnDisable(){RushCityGameEvents.WorldEventChanged-=OnWorldEvent;}

        void Update()
        {
            if(_active==RushWorldEvent.None||!player)return;
            var gm=RushCityGameManager.Instance;
            if(!gm||!gm.IsRunning)return;
            if(Time.time<_nextSpawnAt)return;

            switch(_active)
            {
                case RushWorldEvent.DroneGauntlet:SpawnDroneGauntlet(gm);break;
                case RushWorldEvent.HyperTrain:SpawnHyperTrain(gm);break;
                case RushWorldEvent.StormRush:SpawnStormStrike(gm);break;
            }
            _nextSpawnAt=Time.time+NextInterval(_active);
        }

        void OnWorldEvent(RushWorldEvent worldEvent,bool active)
        {
            _active=active?worldEvent:RushWorldEvent.None;
            _nextSpawnAt=Time.time+.45f;
        }

        float Ahead(RushCityGameManager gm)=>Mathf.Clamp(gm.CurrentSpeed*reactionSeconds,minimumAhead,maximumAhead);
        float CenterX=>RushCityRouteDirector.Instance?RushCityRouteDirector.Instance.TargetCenterX:0f;
        float LaneX(int lane)=>CenterX+(lane-1)*laneWidth;

        void SpawnDroneGauntlet(RushCityGameManager gm)
        {
            var z=player.position.z+Ahead(gm);
            var safeLane=_rng.Next(0,3);
            for(var lane=0;lane<3;lane++)
            {
                if(lane==safeLane)continue;
                var laser=GameObject.CreatePrimitive(PrimitiveType.Cube);
                laser.name=$"DroneLaser_L{lane}";
                laser.transform.position=new Vector3(LaneX(lane),1.25f,z);
                laser.transform.localScale=new Vector3(1.7f,2.5f,.28f);
                laser.GetComponent<Renderer>().sharedMaterial=_red;
                var collider=laser.GetComponent<BoxCollider>();collider.isTrigger=true;
                laser.AddComponent<RushCityWorldEventHazard>().Configure(Vector3.zero,.55f,5.2f,.30f,new Color(1f,.4f,.15f),new Color(1f,.02f,.1f));
            }

            var drone=GameObject.CreatePrimitive(PrimitiveType.Sphere);
            drone.name="DroneGauntlet_Sentinel";
            drone.transform.position=new Vector3(CenterX,4.7f,z-1.4f);
            drone.transform.localScale=new Vector3(2.2f,.48f,1.2f);
            drone.GetComponent<Renderer>().sharedMaterial=_dark;
            Destroy(drone.GetComponent<Collider>());
            Destroy(drone,5.8f);
        }

        void SpawnHyperTrain(RushCityGameManager gm)
        {
            var z=player.position.z+Mathf.Max(Ahead(gm),48f);
            var fromLeft=_rng.NextDouble()>.5;
            var train=GameObject.CreatePrimitive(PrimitiveType.Cube);
            train.name="HyperTrain_Crossing";
            train.transform.position=new Vector3(CenterX+(fromLeft?-8.5f:8.5f),1.25f,z);
            train.transform.localScale=new Vector3(2.25f,2.5f,8.5f);
            train.GetComponent<Renderer>().sharedMaterial=_cyan;
            var collider=train.GetComponent<BoxCollider>();collider.isTrigger=true;
            var velocity=new Vector3(fromLeft?6.8f:-6.8f,0,0);
            train.AddComponent<RushCityWorldEventHazard>().Configure(velocity,.65f,3.9f,.38f,new Color(.1f,.7f,1f),new Color(.02f,1f,1f));
        }

        void SpawnStormStrike(RushCityGameManager gm)
        {
            var z=player.position.z+Ahead(gm);
            var lane=_rng.Next(0,3);
            var strike=GameObject.CreatePrimitive(PrimitiveType.Cube);
            strike.name=$"StormStrike_L{lane}";
            strike.transform.position=new Vector3(LaneX(lane),3.2f,z);
            strike.transform.localScale=new Vector3(1.75f,6.4f,1.05f);
            strike.GetComponent<Renderer>().sharedMaterial=_violet;
            var collider=strike.GetComponent<BoxCollider>();collider.isTrigger=true;
            strike.AddComponent<RushCityWorldEventHazard>().Configure(Vector3.zero,.9f,4.0f,.34f,new Color(.55f,.3f,1f),new Color(.9f,.85f,1f));

            var marker=GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            marker.name="StormStrike_Warning";
            marker.transform.SetParent(strike.transform,false);
            marker.transform.localPosition=new Vector3(0,-.5f,0);
            marker.transform.localScale=new Vector3(.82f,.015f,.82f);
            marker.GetComponent<Renderer>().sharedMaterial=_violet;
            Destroy(marker.GetComponent<Collider>());
        }

        float NextInterval(RushWorldEvent worldEvent)
        {
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:return Mathf.Lerp(1.7f,2.5f,(float)_rng.NextDouble());
                case RushWorldEvent.HyperTrain:return Mathf.Lerp(3.3f,4.8f,(float)_rng.NextDouble());
                case RushWorldEvent.StormRush:return Mathf.Lerp(1.9f,3f,(float)_rng.NextDouble());
                default:return 3f;
            }
        }

        Material Mat(Color color,float emission)
        {
            var shader=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");
            var material=new Material(shader);material.color=color;
            if(emission>0f){material.EnableKeyword("_EMISSION");material.SetColor("_EmissionColor",color*emission);}
            return material;
        }
    }
}
