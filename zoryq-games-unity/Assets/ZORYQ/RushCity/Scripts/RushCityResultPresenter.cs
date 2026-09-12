using UnityEngine;
using UnityEngine.UI;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityResultPresenter : MonoBehaviour
    {
        GameObject _panel;
        Text _title,_score,_stats,_meta,_returning;
        Font _font;

        void Awake(){Build();_panel.SetActive(false);}
        void OnEnable(){RushCityGameEvents.RunEnded+=OnRunEnded;}
        void OnDisable(){RushCityGameEvents.RunEnded-=OnRunEnded;}

        void Build()
        {
#if UNITY_2022_2_OR_NEWER
            _font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
#else
            _font=Resources.GetBuiltinResource<Font>("Arial.ttf");
#endif
            var canvasGo=new GameObject("RushCityResultsCanvas",typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform,false);
            var canvas=canvasGo.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=100;
            var scaler=canvasGo.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1080,1920);scaler.matchWidthOrHeight=.65f;

            _panel=new GameObject("ResultsPanel",typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));
            _panel.transform.SetParent(canvasGo.transform,false);
            var rt=_panel.GetComponent<RectTransform>();rt.anchorMin=Vector2.zero;rt.anchorMax=Vector2.one;rt.offsetMin=rt.offsetMax=Vector2.zero;
            _panel.GetComponent<Image>().color=new Color(.015f,.018f,.045f,.94f);

            _title=TextNode(_panel.transform,"Title","RUN COMPLETE",62,TextAnchor.MiddleCenter,new Vector2(.08f,.72f),new Vector2(.92f,.83f));
            _title.fontStyle=FontStyle.Bold;
            _score=TextNode(_panel.transform,"Score","0",92,TextAnchor.MiddleCenter,new Vector2(.08f,.56f),new Vector2(.92f,.70f));
            _score.color=new Color(.15f,.9f,1f);
            _stats=TextNode(_panel.transform,"Stats","",34,TextAnchor.MiddleCenter,new Vector2(.10f,.39f),new Vector2(.90f,.55f));
            _meta=TextNode(_panel.transform,"Meta","",28,TextAnchor.MiddleCenter,new Vector2(.10f,.29f),new Vector2(.90f,.39f));
            _returning=TextNode(_panel.transform,"Returning","RETURNING TO ZORYQ PLAY…",24,TextAnchor.MiddleCenter,new Vector2(.12f,.16f),new Vector2(.88f,.24f));
            _returning.color=new Color(.7f,.75f,.9f);
        }

        void OnRunEnded(string reason)
        {
            var gm=RushCityGameManager.Instance;if(!gm)return;
            _panel.SetActive(true);
            _title.text=ResultTitle(reason);
            _score.text=gm.Score.ToString("N0");
            _stats.text=$"{gm.DistanceMeters:0}m   ·   ZQ {gm.TotalZq}   ·   COMBO x{Mathf.Max(1,gm.Combo)}";
            var progression=RushCityProgression.Instance;
            var mode=RushCityRunModeDirector.Instance;
            var level=progression?progression.Level:1;
            var modeText=mode?mode.Mode.ToString().ToUpperInvariant():"STANDARD";
            _meta.text=$"{modeText}   ·   LEVEL {level}   ·   LOCAL RUN";
        }

        string ResultTitle(string reason)
        {
            switch(reason)
            {
                case "chase-caught":return "CHASE ENDED";
                case "impact":return "RUN INTERRUPTED";
                case "fell":return "ROUTE LOST";
                default:return "RUN COMPLETE";
            }
        }

        Text TextNode(Transform parent,string name,string value,int size,TextAnchor anchor,Vector2 min,Vector2 max)
        {
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));go.transform.SetParent(parent,false);
            var rt=go.GetComponent<RectTransform>();rt.anchorMin=min;rt.anchorMax=max;rt.offsetMin=rt.offsetMax=Vector2.zero;
            var text=go.GetComponent<Text>();text.font=_font;text.text=value;text.fontSize=size;text.alignment=anchor;text.color=Color.white;text.raycastTarget=false;text.horizontalOverflow=HorizontalWrapMode.Wrap;text.verticalOverflow=VerticalWrapMode.Overflow;
            return text;
        }
    }
}
