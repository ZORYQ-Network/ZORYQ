using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityTrackManager : MonoBehaviour
    {
        public Transform player;
        public int visibleSegments = 10;
        public float segmentLength = 24f;
        public int seed = 42042;

        readonly Queue<GameObject> _segments = new Queue<GameObject>();
        System.Random _rng;
        float _nextZ;
        Material _road;
        Material _cyan;
        Material _magenta;
        Material _zq;

        void Start()
        {
            _rng = new System.Random(seed);
            _road = CreateMaterial(new Color(.018f,.024f,.05f), 0f);
            _cyan = CreateMaterial(new Color(.02f,.74f,1f), 2.4f);
            _magenta = CreateMaterial(new Color(.88f,.08f,1f), 2.2f);
            _zq = CreateMaterial(new Color(.45f,.18f,1f), 3.4f);
            for (var i = 0; i < visibleSegments; i++) SpawnSegment(i < 2 ? 0 : _rng.Next(0,5));
        }

        void Update()
        {
            if (!player || _segments.Count == 0) return;
            while (_segments.Peek().transform.position.z + segmentLength < player.position.z - segmentLength)
            {
                var old = _segments.Dequeue();
                Destroy(old);
                SpawnSegment(_rng.Next(0,5));
            }
        }

        void SpawnSegment(int pattern)
        {
            var root = new GameObject($"RushSegment_{_nextZ:0000}");
            root.transform.SetParent(transform);
            root.transform.position = new Vector3(0,0,_nextZ);

            CreateCube(root.transform, "Road", new Vector3(0,-.2f,segmentLength*.5f), new Vector3(9,.35f,segmentLength), _road, false);
            CreateCube(root.transform, "RailL", new Vector3(-5.15f,.65f,segmentLength*.5f), new Vector3(.22f,1.4f,segmentLength), _cyan, false);
            CreateCube(root.transform, "RailR", new Vector3(5.15f,.65f,segmentLength*.5f), new Vector3(.22f,1.4f,segmentLength), _magenta, false);

            BuildPattern(root.transform, pattern);
            BuildCoinLine(root.transform, _rng.Next(0,3), 5, 3.4f, 6f);
            if (_rng.NextDouble() > .42) BuildCoinLine(root.transform, _rng.Next(0,3), 4, 3.2f, 14f);

            _segments.Enqueue(root);
            _nextZ += segmentLength;
        }

        void BuildPattern(Transform root, int pattern)
        {
            switch (pattern)
            {
                case 0:
                    CreateObstacle(root, _rng.Next(0,3), 12f, 1.5f, 1.45f);
                    break;
                case 1:
                    CreateObstacle(root, 0, 11f, 2.1f, 2.7f);
                    CreateObstacle(root, 2, 11f, 2.1f, 2.7f);
                    break;
                case 2:
                    CreateObstacle(root, 1, 10f, 2.0f, .82f);
                    CreateCube(root, "OverGate", new Vector3(0,2.55f,10f), new Vector3(2.2f,.5f,.9f), _magenta, false);
                    break;
                case 3:
                    CreateCube(root, "Ramp", new Vector3(-2.65f,.45f,12f), new Vector3(2.0f,.3f,5.5f), _cyan, false, Quaternion.Euler(-12,0,0));
                    CreateObstacle(root, 1, 14f, 1.6f, 2.1f);
                    break;
                case 4:
                    CreateCube(root, "WallRunLeft", new Vector3(-4.15f,1.35f,13f), new Vector3(.4f,2.7f,8f), _cyan, false);
                    CreateObstacle(root, 1, 13f, 2.1f, 2.8f);
                    CreateCube(root, "WallRunRight", new Vector3(4.15f,1.35f,13f), new Vector3(.4f,2.7f,8f), _magenta, false);
                    break;
            }
        }

        void BuildCoinLine(Transform root, int lane, int count, float spacing, float startZ)
        {
            var x = (lane - 1) * 2.65f;
            for (int i=0;i<count;i++)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                go.name = "ZQ";
                go.transform.SetParent(root);
                go.transform.localPosition = new Vector3(x,1.1f,startZ+i*spacing);
                go.transform.localRotation = Quaternion.Euler(90,0,0);
                go.transform.localScale = new Vector3(.42f,.08f,.42f);
                go.GetComponent<Renderer>().sharedMaterial = _zq;
                var col = go.GetComponent<Collider>(); col.isTrigger = true;
                go.AddComponent<RushCityCollectible>();
            }
        }

        void CreateObstacle(Transform root, int lane, float z, float width, float height)
        {
            var x = (lane - 1) * 2.65f;
            var go = CreateCube(root, "Obstacle", new Vector3(x,height*.5f,z), new Vector3(width,height,.8f), _magenta, true);
            go.AddComponent<RushCityObstacle>();
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
