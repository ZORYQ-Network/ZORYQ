using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityProceduralCity : MonoBehaviour
    {
        sealed class BuildingEntry
        {
            public Transform root;
            public Renderer body;
            public Renderer stripe;
            public Transform crown;
            public Renderer crownRenderer;
            public float lateralOffset;
            public Vector3 baseSize;
            public bool right;
        }

        public Transform player;
        public int buildingPairs = 36;
        public float spacing = 11f;
        public float recycleBehind = 35f;
        readonly List<BuildingEntry> _buildings = new List<BuildingEntry>();
        Material _dark,_harborDark,_skyDark,_metroDark,_cyan,_violet,_gold,_green;
        RushDistrict _lastDistrict=(RushDistrict)(-1);

        void Start()
        {
            _dark = Mat(new Color(.015f,.018f,.035f),0);
            _harborDark = Mat(new Color(.012f,.032f,.04f),.1f);
            _skyDark = Mat(new Color(.025f,.02f,.055f),.12f);
            _metroDark = Mat(new Color(.045f,.022f,.018f),.08f);
            _cyan = Mat(new Color(.02f,.55f,.95f),1.8f);
            _violet = Mat(new Color(.58f,.08f,.9f),1.7f);
            _gold = Mat(new Color(1f,.42f,.04f),1.9f);
            _green = Mat(new Color(.02f,.9f,.52f),1.8f);
            for(int i=0;i<buildingPairs;i++) { Spawn(i,false); Spawn(i,true); }
            ApplyDistrictToAll(RushDistrict.NeoDowntown);
        }

        void Update()
        {
            if(!player) return;
            var maxZ = player.position.z + buildingPairs * spacing * .55f;
            var center=RushCityRouteDirector.Instance?RushCityRouteDirector.Instance.CurrentCenterX:0f;
            var district=RushCityRouteDirector.Instance?RushCityRouteDirector.Instance.District:RushDistrict.NeoDowntown;
            if(district!=_lastDistrict)ApplyDistrictToAll(district);

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
                    ApplyStyle(b,district);
                }
                b.root.position=p;
            }
        }

        void Spawn(int i,bool right)
        {
            var go=GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.transform.SetParent(transform);
            var h=Random.Range(7f,23f);var w=Random.Range(4f,8f);var depth=Random.Range(5f,10f);
            var offset=(right?1:-1)*Random.Range(10f,18f);
            var baseSize=new Vector3(w,h,depth);
            go.transform.localScale=baseSize;
            go.transform.position=new Vector3(offset,h*.5f-1f,i*spacing+Random.Range(-3f,3f));
            var body=go.GetComponent<Renderer>();body.sharedMaterial=_dark;
            Destroy(go.GetComponent<Collider>());

            var stripe=GameObject.CreatePrimitive(PrimitiveType.Cube);
            stripe.name="DistrictAccent";stripe.transform.SetParent(go.transform);
            stripe.transform.localScale=new Vector3(.02f,.8f,1.02f);
            stripe.transform.localPosition=new Vector3(right?-.505f:.505f,0,0);
            var stripeRenderer=stripe.GetComponent<Renderer>();
            Destroy(stripe.GetComponent<Collider>());

            var crown=GameObject.CreatePrimitive(PrimitiveType.Cube);
            crown.name="DistrictSilhouette";crown.transform.SetParent(go.transform);
            var crownRenderer=crown.GetComponent<Renderer>();
            Destroy(crown.GetComponent<Collider>());

            var entry=new BuildingEntry
            {
                root=go.transform,body=body,stripe=stripeRenderer,crown=crown.transform,crownRenderer=crownRenderer,
                lateralOffset=offset,baseSize=baseSize,right=right
            };
            _buildings.Add(entry);
            ApplyStyle(entry,RushDistrict.NeoDowntown);
        }

        void ApplyDistrictToAll(RushDistrict district)
        {
            _lastDistrict=district;
            for(var i=0;i<_buildings.Count;i++)ApplyStyle(_buildings[i],district);
        }

        void ApplyStyle(BuildingEntry b,RushDistrict district)
        {
            if(b==null||!b.root)return;
            var baseSize=b.baseSize;
            var side=b.right?1f:-1f;
            b.stripe.sharedMaterial=DistrictMaterial(district,b.right);
            b.crownRenderer.sharedMaterial=DistrictMaterial(district,!b.right);

            switch(district)
            {
                case RushDistrict.CyberHarbor:
                    b.root.name=b.right?"HarborStack_R":"HarborStack_L";
                    b.root.localScale=new Vector3(baseSize.x*1.28f,baseSize.y*.58f,baseSize.z*1.42f);
                    b.body.sharedMaterial=_harborDark;
                    b.stripe.transform.localScale=new Vector3(.02f,.38f,1.02f);
                    b.crown.localPosition=new Vector3(-side*.38f,.57f,0f);
                    b.crown.localScale=new Vector3(.9f,.035f,.12f);
                    break;
                case RushDistrict.Skyline:
                    b.root.name=b.right?"SkyTower_R":"SkyTower_L";
                    b.root.localScale=new Vector3(baseSize.x*.72f,baseSize.y*1.55f,baseSize.z*.78f);
                    b.body.sharedMaterial=_skyDark;
                    b.stripe.transform.localScale=new Vector3(.025f,.92f,1.02f);
                    b.crown.localPosition=new Vector3(0,.56f,0);
                    b.crown.localScale=new Vector3(.08f,.24f,.08f);
                    break;
                case RushDistrict.OldMetro:
                    b.root.name=b.right?"MetroBlock_R":"MetroBlock_L";
                    b.root.localScale=new Vector3(baseSize.x*1.38f,baseSize.y*.68f,baseSize.z*1.18f);
                    b.body.sharedMaterial=_metroDark;
                    b.stripe.transform.localScale=new Vector3(.02f,.55f,1.02f);
                    b.crown.localPosition=new Vector3(0,.52f,0);
                    b.crown.localScale=new Vector3(.72f,.045f,.22f);
                    break;
                default:
                    b.root.name=b.right?"NeoTower_R":"NeoTower_L";
                    b.root.localScale=baseSize;
                    b.body.sharedMaterial=_dark;
                    b.stripe.transform.localScale=new Vector3(.02f,.8f,1.02f);
                    b.crown.localPosition=new Vector3(side*.28f,.54f,0);
                    b.crown.localScale=new Vector3(.28f,.06f,.16f);
                    break;
            }
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
