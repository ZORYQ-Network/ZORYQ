using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityEnvironmentDirector : MonoBehaviour
    {
        [SerializeField] Light keyLight;
        [SerializeField] float stormFogDensity=.026f;
        [SerializeField] float clearFogDensity=.012f;
        float _nextFlash;
        float _flash;
        RushDistrict _lastDistrict=(RushDistrict)(-1);

        public void Configure(Light light){keyLight=light;}

        void Start(){ScheduleFlash();ApplyDistrict(true);}

        void Update()
        {
            ApplyDistrict(false);
            var live=RushCityLiveOpsConfig.Instance;
            var events=RushCityWorldEventDirector.Instance;
            var seasonStorm=live&&live.Current.stormEventEnabled;
            var worldStorm=events&&events.StormActive;
            var storm=seasonStorm||worldStorm;
            var eventIntensity=events?events.Intensity:0f;
            var targetFog=storm?stormFogDensity:Mathf.Lerp(clearFogDensity,clearFogDensity*1.35f,eventIntensity);
            RenderSettings.fogDensity=Mathf.Lerp(RenderSettings.fogDensity,targetFog,1f-Mathf.Exp(-1.6f*Time.deltaTime));

            if(storm&&Time.time>=_nextFlash){_flash=1f;ScheduleFlash();}
            _flash=Mathf.MoveTowards(_flash,0f,Time.deltaTime*7f);
            if(keyLight)
            {
                var baseIntensity=storm ? .72f : Mathf.Lerp(1.15f,.9f,eventIntensity);
                keyLight.intensity=baseIntensity+_flash*3.6f;
                keyLight.color=EventLightColor(events?events.ActiveEvent:RushWorldEvent.None,eventIntensity);
            }
        }

        void ApplyDistrict(bool force)
        {
            var route=RushCityRouteDirector.Instance;if(!route)return;
            if(!force&&route.District==_lastDistrict)return;
            _lastDistrict=route.District;
            switch(route.District)
            {
                case RushDistrict.CyberHarbor:RenderSettings.fogColor=new Color(.008f,.045f,.065f);break;
                case RushDistrict.Skyline:RenderSettings.fogColor=new Color(.045f,.024f,.07f);break;
                case RushDistrict.OldMetro:RenderSettings.fogColor=new Color(.055f,.025f,.02f);break;
                default:RenderSettings.fogColor=new Color(.012f,.018f,.045f);break;
            }
        }

        Color EventLightColor(RushWorldEvent worldEvent,float intensity)
        {
            var normal=new Color(.58f,.72f,1f);
            Color eventColor;
            switch(worldEvent)
            {
                case RushWorldEvent.DroneGauntlet:eventColor=new Color(1f,.28f,.35f);break;
                case RushWorldEvent.HyperTrain:eventColor=new Color(.25f,.95f,1f);break;
                case RushWorldEvent.StormRush:eventColor=new Color(.55f,.35f,1f);break;
                default:eventColor=normal;break;
            }
            return Color.Lerp(normal,eventColor,Mathf.Clamp01(intensity*.72f));
        }

        void ScheduleFlash(){_nextFlash=Time.time+Random.Range(3.5f,8.5f);}
    }
}
