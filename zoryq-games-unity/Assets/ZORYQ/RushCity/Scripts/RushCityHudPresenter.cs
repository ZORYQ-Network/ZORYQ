using UnityEngine;
using UnityEngine.UI;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityHudPresenter : MonoBehaviour
    {
        Text _score,_zq,_combo,_district,_power,_toast;
        Image _chaseFill,_flowFill;
        float _toastUntil;
        Font _font;

        void Awake(){Build();}

        void OnEnable()
        {
            RushCityGameEvents.NearMissed+=()=>Toast("NEAR MISS  +FLOW");
            RushCityGameEvents.PowerUpActivated+=OnPowerUp;
            RushCityGameEvents.RouteChosen+=OnRoute;
            RushCityGameEvents.MissionCompleted+=OnMission;
        }

        void OnDisable()
        {
            RushCityGameEvents.PowerUpActivated-=OnPowerUp;
            RushCityGameEvents.RouteChosen-=OnRoute;
            RushCityGameEvents.MissionCompleted-=OnMission;
        }

        void Build()
        {
#if UNITY_2022_2_OR_NEWER
            _font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
#else
            _font=Resources.GetBuiltinResource<Font>("Arial.ttf");
#endif
            var canvasGo=new GameObject("RushCityHUD",typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform,false);
            var canvas=canvasGo.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=50;
            var scaler=canvasGo.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1080,1920);scaler.matchWidthOrHeight=.65f;

            _score=TextNode(canvasGo.transform,"Score","0",38,TextAnchor.UpperLeft,new Vector2(.04f,.94f),new Vector2(.48f,.99f));
            _zq=TextNode(canvasGo.transform,"ZQ","ZQ 0",38,TextAnchor.UpperRight,new Vector2(.55f,.94f),new Vector2(.96f,.99f));
            _combo=TextNode(canvasGo.transform,"Combo","",30,TextAnchor.MiddleCenter,new Vector2(.32f,.865f),new Vector2(.68f,.91f));
            _district=TextNode(canvasGo.transform,"District","NEO DOWNTOWN",24,TextAnchor.MiddleLeft,new Vector2(.04f,.90f),new Vector2(.55f,.935f));
            _power=TextNode(canvasGo.transform,"Power","",24,TextAnchor.MiddleRight,new Vector2(.48f,.90f),new Vector2(.96f,.935f));
            _toast=TextNode(canvasGo.transform,"Toast","",34,TextAnchor.MiddleCenter,new Vector2(.16f,.72f),new Vector2(.84f,.79f));
            _toast.fontStyle=FontStyle.Bold;

            CreateBar(canvasGo.transform,"ChaseBar",new Vector2(.04f,.835f),new Vector2(.96f,.852f),new Color(.11f,.12f,.17f,.8f),new Color(1f,.08f,.25f,.95f),out _chaseFill);
            CreateBar(canvasGo.transform,"FlowBar",new Vector2(.04f,.81f),new Vector2(.96f,.824f),new Color(.11f,.12f,.17f,.65f),new Color(.05f,.88f,1f,.92f),out _flowFill);
        }

        void Update()
        {
            var gm=RushCityGameManager.Instance;if(!gm)return;
            _score.text=gm.Score.ToString("N0");
            _zq.text=$"ZQ  {gm.TotalZq}";
            _combo.text=gm.Combo>1?$"COMBO  x{gm.Combo}":string.Empty;
            _district.text=RushCityRouteDirector.Instance?FormatDistrict(RushCityRouteDirector.Instance.District):"NEO DOWNTOWN";
            _chaseFill.fillAmount=gm.ChasePressure;
            _flowFill.fillAmount=gm.SkillFlow;
            _power.text=PowerText(gm);
            if(Time.unscaledTime>_toastUntil)_toast.text=string.Empty;
            else
            {
                var c=_toast.color;c.a=Mathf.Clamp01((_toastUntil-Time.unscaledTime)*2.2f);_toast.color=c;
            }
        }

        string PowerText(RushCityGameManager gm)
        {
            if(gm.OverdriveActive)return $"OVERDRIVE {gm.OverdriveSeconds:0.0}s";
            if(gm.MagnetActive)return $"MAGNET {gm.MagnetSeconds:0.0}s";
            if(gm.MultiplierSeconds>0)return $"2X {gm.MultiplierSeconds:0.0}s";
            if(gm.ShieldCharges>0)return $"SHIELD x{gm.ShieldCharges}";
            return string.Empty;
        }

        string FormatDistrict(RushDistrict d)
        {
            switch(d){case RushDistrict.CyberHarbor:return "CYBER HARBOR";case RushDistrict.Skyline:return "SKYLINE";case RushDistrict.OldMetro:return "OLD METRO";default:return "NEO DOWNTOWN";}
        }

        void OnPowerUp(RushPowerUpType type,float duration)=>Toast(type.ToString().ToUpperInvariant()+"  ONLINE");
        void OnRoute(int direction,string district)=>Toast((direction<0?"LEFT ROUTE · ":"RIGHT ROUTE · ")+district.ToUpperInvariant());
        void OnMission(int score,int zq,string mission)=>Toast($"MISSION COMPLETE  +{zq} ZQ");
        void Toast(string value){_toast.text=value;var c=_toast.color;c.a=1f;_toast.color=c;_toastUntil=Time.unscaledTime+1.55f;}

        Text TextNode(Transform parent,string name,string value,int size,TextAnchor align,Vector2 min,Vector2 max)
        {
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));go.transform.SetParent(parent,false);
            var rt=go.GetComponent<RectTransform>();rt.anchorMin=min;rt.anchorMax=max;rt.offsetMin=rt.offsetMax=Vector2.zero;
            var t=go.GetComponent<Text>();t.font=_font;t.text=value;t.fontSize=size;t.alignment=align;t.color=Color.white;t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Overflow;
            return t;
        }

        void CreateBar(Transform parent,string name,Vector2 min,Vector2 max,Color bg,Color fg,out Image fill)
        {
            var root=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));root.transform.SetParent(parent,false);
            var rt=root.GetComponent<RectTransform>();rt.anchorMin=min;rt.anchorMax=max;rt.offsetMin=rt.offsetMax=Vector2.zero;
            root.GetComponent<Image>().color=bg;
            var f=new GameObject("Fill",typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));f.transform.SetParent(root.transform,false);
            var fr=f.GetComponent<RectTransform>();fr.anchorMin=Vector2.zero;fr.anchorMax=Vector2.one;fr.offsetMin=fr.offsetMax=Vector2.zero;
            fill=f.GetComponent<Image>();fill.color=fg;fill.type=Image.Type.Filled;fill.fillMethod=Image.FillMethod.Horizontal;fill.fillOrigin=(int)Image.OriginHorizontal.Left;fill.fillAmount=0f;fill.raycastTarget=false;
        }
    }
}
