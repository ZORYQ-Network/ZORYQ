using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityProceduralCity : MonoBehaviour
    {
        sealed class BuildingEntry
        {
            public Transform root;
            public Renderer stripe;
            public float lateralOffset;
        }

        public Transform player;
        public int buildingPairs = 36;
        public float spacing = 11f;
        public float recycleBehind = 35f;
        readonly List<BuildingEntry> _buildings = new List<BuildingEntry>();
        Material _dark, _cyan, _violet, _gold, _green;

        void Start()
        {
            _dark = Mat(new Color(.015f,.018f,.035f),0);
            _cyan = Mat(new Color(.02f,.55f,.95f),1.8f);
            _violet = Mat(new Color(.58f,.08f,.9f),1.7f);
            _gold = Mat(new Color(1f,.42f,.04f),1.9f);
            _green = Mat(new Color(.02f,.9f,.52f),1.8f);
            for(int i=0;i<buildingPairs;i++) { Spawn(i,false); Spawn(i,true); }
        }

        void Update()
        {
            if(!player) return;
            var maxZ = player.position.z + buildingPairs * spacing * .55f;
            var center=RushCityRouteDirector.Instance?RushCityRouteDirector.Instance.CurrentCenterX:0f;
            var district=RushCityRouteDirector.Instance?RushCityRouteDirector.Instance.District:RushDistrict.NeoDowntown;
            foreach(var b in _buildings)
            {
                if(!b.root)continue;
                var p=b.root.position;
                p.x=Mathf.Lerp(p.x,center+b.lateralOffset,1f-Mathf.Exp(-3.5f*Time.deltaTime));
                if(p.z < player.position.z - recycleBehind)
                {
                    p.z=maxZ += spacing*.5f;
                    var side=Mathf.Sign(b.lateralOffset);
                    b.lateralOffset=side*Random.Range(10f,18f);
                    p.x=center+b.lateralOffset;
                    if(b.stripe)b.stripe.sharedMaterial=DistrictMaterial(district,side>0);
                }
                b.root.position=p;
            }
        }

        void Spawn(int i,bool right)
        {
            var go=GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name=right?"NeoBuilding_R":"NeoBuilding_L";
            go.transform.SetParent(transform);
            var h=Random.Range(7f,23f); var w=Random.Range(4f,8f);
            var offset=(right?1:-1)*Random.Range(10f,18f);
            go.transform.localScale=new Vector3(w,h,Random.Range(5f,10f));
            go.transform.position=new Vector3(offset,h*.5f-1f,i*spacing+Random.Range(-3f,3f));
            go.GetComponent<Renderer>().sharedMaterial=_dark;
            Destroy(go.GetComponent<Collider>());

            var stripe=GameObject.CreatePrimitive(PrimitiveType.Cube);
            stripe.name="NeonStripe"; stripe.transform.SetParent(go.transform);
            stripe.transform.localScale=new Vector3(.02f,.8f,1.02f);
            stripe.transform.localPosition=new Vector3(right?-.505f:.505f,0,0);
            var stripeRenderer=stripe.GetComponent<Renderer>(); stripeRenderer.sharedMaterial=DistrictMaterial(RushDistrict.NeoDowntown,right);
            Destroy(stripe.GetComponent<Collider>());
            _buildings.Add(new BuildingEntry{root=go.transform,stripe=stripeRenderer,lateralOffset=offset});
        }

        Material DistrictMaterial(RushDistrict district,bool right)
        {
            switch(district)
            {
                case RushDistrict.CyberHarbor:return right?_cyan:_green;
                case RushDistrict.Skyline:return right?_gold:_cyan;
                case RushDistrict.OldMetro:return right?_violet:_gold;
                default:return right?_violet:_cyan;
            }
        }

        Material Mat(Color c,float e){var s=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");var m=new Material(s);m.color=c;if(e>0){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",c*e);}return m;}
    }
}
