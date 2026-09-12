using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityTrackManager : MonoBehaviour
    {
        public static RushCityTrackManager Instance { get; private set; }
        public Transform player;
        public int visibleSegments = 11;
        public float segmentLength = 24f;
        public int seed = 42042;

        readonly Queue<GameObject> _segments = new Queue<GameObject>();
        System.Random _rng;
        float _nextZ;
        int _spawnedSegments;
        Material _road,_cyan,_magenta,_zq,_gold,_green;

        void Awake(){Instance=this;}

        void Start()
        {
            _rng = new System.Random(seed);
            _road = CreateMaterial(new Color(.018f,.024f,.05f), 0f);
            _cyan = CreateMaterial(new Color(.02f,.74f,1f), 2.4f);
            _magenta = CreateMaterial(new Color(.88f,.08f,1f), 2.2f);
            _zq = CreateMaterial(new Color(.45f,.18f,1f), 3.4f);
            _gold = CreateMaterial(new Color(1f,.55f,.08f),3f);
            _green = CreateMaterial(new Color(.08f,1f,.55f),2.6f);
            for (var i = 0; i < visibleSegments; i++) SpawnSegment(i < 2 ? 0 : _rng.Next(0,8));
        }

        void Update()
        {
            if (!player || _segments.Count == 0) return;
            while (_segments.Peek().transform.position.z + segmentLength < player.position.z - segmentLength)
            {
                var old = _segments.Dequeue();
                Destroy(old);
                SpawnSegment(_rng.Next(0,8));
            }
        }

        public void ShiftFutureSegments(float fromWorldZ,float deltaX)
        {
            if(Mathf.Abs(deltaX)<.01f)return;
            foreach(var segment in _segments)
            {
                if(!segment||segment.transform.position.z<fromWorldZ)continue;
                segment.transform.position+=Vector3.right*deltaX;
            }
        }

        float ZqDensity
        {
            get
            {
                var live=RushCityLiveOpsConfig.Instance;
                return live?Mathf.Clamp(live.Current.zqDensityMultiplier,.65f,1.6f):1f;
            }
        }

        void SpawnSegment(int pattern)
        {
            var root = new GameObject($"RushSegment_{_nextZ:0000}");
            root.transform.SetParent(transform);
            var centerX=RushCityRouteDirector.Instance ? RushCityRouteDirector.Instance.TargetCenterX : 0f;
            root.transform.position = new Vector3(centerX,0,_nextZ);

            CreateCube(root.transform, "Road", new Vector3(0,-.2f,segmentLength*.5f), new Vector3(9,.35f,segmentLength), _road, true);
            CreateCube(root.transform, "RailL", new Vector3(-5.15f,.65f,segmentLength*.5f), new Vector3(.22f,1.4f,segmentLength), _cyan, false);
            CreateCube(root.transform, "RailR", new Vector3(5.15f,.65f,segmentLength*.5f), new Vector3(.22f,1.4f,segmentLength), _magenta, false);

            BuildPattern(root.transform, pattern);
            var density=ZqDensity;
            BuildCoinLine(root.transform, _rng.Next(0,3), Mathf.Clamp(Mathf.RoundToInt(5*density),3,9), 3.4f, 5.5f);
            var secondLineChance=Mathf.Lerp(.35f,.78f,Mathf.InverseLerp(.65f,1.6f,density));
            if (_rng.NextDouble() < secondLineChance) BuildCoinLine(root.transform, _rng.Next(0,3), Mathf.Clamp(Mathf.RoundToInt(4*density),3,8), 3.2f, 14f);
            if (_rng.NextDouble() > .84) SpawnPowerUp(root.transform,_rng.Next(0,3),17.5f,(RushPowerUpType)_rng.Next(0,4));
            if(_spawnedSegments>=5 && _spawnedSegments%7==0)BuildBranchGateway(root.transform);

            _segments.Enqueue(root);
            _nextZ += segmentLength;
            _spawnedSegments++;
        }

        void BuildPattern(Transform root, int pattern)
        {
            switch (pattern)
            {
                case 0: CreateObstacle(root, _rng.Next(0,3), 12f, 1.5f, 1.45f); break;
                case 1:
                    CreateObstacle(root, 0, 11f, 2.1f, 2.7f); CreateObstacle(root, 2, 11f, 2.1f, 2.7f); break;
                case 2:
                    CreateObstacle(root, 1, 10f, 2.0f, .82f);
                    CreateCube(root, "OverGate", new Vector3(0,2.55f,10f), new Vector3(2.2f,.5f,.9f), _magenta, false); break;
                case 3:
                    CreateCube(root, "Ramp", new Vector3(-2.65f,.45f,12f), new Vector3(2.0f,.3f,5.5f), _cyan, true, Quaternion.Euler(-12,0,0));
                    CreateObstacle(root, 1, 14f, 1.6f, 2.1f); break;
                case 4:
                    CreateCube(root, "WallRunLeft", new Vector3(-4.15f,1.35f,13f), new Vector3(.4f,2.7f,8f), _cyan, true);
                    CreateObstacle(root, 1, 13f, 2.1f, 2.8f);
                    CreateCube(root, "WallRunRight", new Vector3(4.15f,1.35f,13f), new Vector3(.4f,2.7f,8f), _magenta, true); break;
                case 5:
                    CreateObstacle(root,0,8f,1.5f,1.2f); CreateObstacle(root,1,13f,1.5f,1.2f); CreateObstacle(root,2,18f,1.5f,1.2f); break;
                case 6:
                    CreateObstacle(root,0,10f,1.7f,2.5f); CreateObstacle(root,1,10f,1.7f,2.5f);
                    CreateCube(root,"JumpGate",new Vector3(2.65f,.35f,14f),new Vector3(1.9f,.3f,3.4f),_cyan,true,Quaternion.Euler(-9,0,0)); break;
                case 7:
                    CreateCube(root,"WallRunLeft",new Vector3(-4.15f,1.4f,12f),new Vector3(.4f,2.8f,10f),_cyan,true);
                    CreateCube(root,"WallRunRight",new Vector3(4.15f,1.4f,12f),new Vector3(.4f,2.8f,10f),_magenta,true);
                    CreateObstacle(root,0,12f,1.8f,2.9f); CreateObstacle(root,2,12f,1.8f,2.9f); break;
            }
        }

        void BuildBranchGateway(Transform root)
        {
            CreateCube(root,"BranchDeck",new Vector3(0,-.13f,18.5f),new Vector3(29f,.30f,11f),_road,true);
            CreateCube(root,"BranchLeftGuide",new Vector3(-5.8f,.05f,19f),new Vector3(6.5f,.10f,.22f),_cyan,false,Quaternion.Euler(0,-28f,0));
            CreateCube(root,"BranchRightGuide",new Vector3(5.8f,.05f,19f),new Vector3(6.5f,.10f,.22f),_magenta,false,Quaternion.Euler(0,28f,0));
            var zone=new GameObject("RouteChoiceZone"); zone.transform.SetParent(root); zone.transform.localPosition=new Vector3(0,1.5f,17f);
            var trigger=zone.AddComponent<BoxCollider>(); trigger.isTrigger=true; trigger.size=new Vector3(9f,3f,2.5f);
            zone.AddComponent<RushCityRouteChoiceZone>();
        }

        void BuildCoinLine(Transform root, int lane, int count, float spacing, float startZ)
        {
            var x = (lane - 1) * 2.65f;
            for (int i=0;i<count;i++)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                go.name = "ZQ"; go.transform.SetParent(root);
                go.transform.localPosition = new Vector3(x,1.1f,startZ+i*spacing);
                go.transform.localRotation = Quaternion.Euler(90,0,0); go.transform.localScale = new Vector3(.42f,.08f,.42f);
                go.GetComponent<Renderer>().sharedMaterial = _zq;
                go.GetComponent<Collider>().isTrigger = true; go.AddComponent<RushCityCollectible>();
            }
        }

        void SpawnPowerUp(Transform root,int lane,float z,RushPowerUpType type)
        {
            var go=GameObject.CreatePrimitive(PrimitiveType.Sphere); go.name=$"PowerUp_{type}"; go.transform.SetParent(root);
            go.transform.localPosition=new Vector3((lane-1)*2.65f,1.15f,z); go.transform.localScale=Vector3.one*.7f;
            go.GetComponent<Renderer>().sharedMaterial = type==RushPowerUpType.Shield?_cyan:type==RushPowerUpType.Overdrive?_gold:type==RushPowerUpType.Multiplier?_green:_magenta;
            go.GetComponent<Collider>().isTrigger=true;
            go.AddComponent<RushCityPowerUp>().Configure(type,type==RushPowerUpType.Shield?4f:8f);
        }

        void CreateObstacle(Transform root, int lane, float z, float width, float height)
        {
            var x = (lane - 1) * 2.65f;
            var go = CreateCube(root, "Obstacle", new Vector3(x,height*.5f,z), new Vector3(width,height,.8f), _magenta, true);
            go.AddComponent<RushCityObstacle>();
            var near=new GameObject("NearMissZone"); near.transform.SetParent(root); near.transform.localPosition=new Vector3(x,height*.5f,z);
            var trigger=near.AddComponent<BoxCollider>(); trigger.isTrigger=true; trigger.size=new Vector3(width+1.25f,height+1.1f,3.2f);
            near.AddComponent<RushCityNearMissZone>();
        }

        GameObject CreateCube(Transform root,string name,Vector3 localPos,Vector3 scale,Material material,bool collider,Quaternion? rotation=null)
        {
            var go=GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name=name; go.transform.SetParent(root); go.transform.localPosition=localPos; go.transform.localScale=scale;
            if(rotation.HasValue) go.transform.localRotation=rotation.Value;
            go.GetComponent<Renderer>().sharedMaterial=material;
            var c=go.GetComponent<Collider>(); if(!collider) Destroy(c);
            return go;
        }

        Material CreateMaterial(Color color,float emission)
        {
            var shader=Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var m=new Material(shader); m.color=color;
            if(emission>0){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",color*emission);}
            return m;
        }
    }
}
