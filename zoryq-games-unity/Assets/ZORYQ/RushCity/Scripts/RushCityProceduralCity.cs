using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityProceduralCity : MonoBehaviour
    {
        public Transform player;
        public int buildingPairs = 36;
        public float spacing = 11f;
        public float recycleBehind = 35f;
        readonly List<Transform> _buildings = new List<Transform>();
        Material _dark, _cyan, _violet;

        void Start()
        {
            _dark = Mat(new Color(.015f,.018f,.035f),0);
            _cyan = Mat(new Color(.02f,.55f,.95f),1.8f);
            _violet = Mat(new Color(.58f,.08f,.9f),1.7f);
            for(int i=0;i<buildingPairs;i++) { Spawn(i,false); Spawn(i,true); }
        }

        void Update()
        {
            if(!player) return;
            var maxZ = player.position.z + buildingPairs * spacing * .55f;
            foreach(var b in _buildings)
                if(b.position.z < player.position.z - recycleBehind)
                    b.position = new Vector3(b.position.x,b.position.y,maxZ += spacing*.5f);
        }

        void Spawn(int i,bool right)
        {
            var go=GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name="NeoBuilding";
            go.transform.SetParent(transform);
            var h=Random.Range(7f,23f); var w=Random.Range(4f,8f);
            go.transform.localScale=new Vector3(w,h,Random.Range(5f,10f));
            go.transform.position=new Vector3((right?1:-1)*Random.Range(10f,18f),h*.5f-1f,i*spacing+Random.Range(-3f,3f));
            go.GetComponent<Renderer>().sharedMaterial=_dark;
            Destroy(go.GetComponent<Collider>());
            _buildings.Add(go.transform);

            var stripe=GameObject.CreatePrimitive(PrimitiveType.Cube);
            stripe.name="NeonStripe"; stripe.transform.SetParent(go.transform);
            stripe.transform.localScale=new Vector3(.02f,.8f,1.02f);
            stripe.transform.localPosition=new Vector3(right?-.505f:.505f,0,0);
            stripe.GetComponent<Renderer>().sharedMaterial=right?_violet:_cyan;
            Destroy(stripe.GetComponent<Collider>());
        }

        Material Mat(Color c,float e){var s=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");var m=new Material(s);m.color=c;if(e>0){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",c*e);}return m;}
    }
}
