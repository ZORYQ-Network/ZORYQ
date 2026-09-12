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
            var storm=live&&live.Current.stormEventEnabled;
            var targetFog=storm?stormFogDensity:clearFogDensity;
            RenderSettings.fogDensity=Mathf.Lerp(RenderSettings.fogDensity,targetFog,1f-Mathf.Exp(-1.6f*Time.deltaTime));

            if(storm&&Time.time>=_nextFlash){_flash=1f;ScheduleFlash();}
            _flash=Mathf.MoveTowards(_flash,0f,Time.deltaTime*7f);
            if(keyLight)
            {
                var baseIntensity=storm ? .72f : 1.15f;
                keyLight.intensity=baseIntensity+_flash*3.6f;
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

        void ScheduleFlash(){_nextFlash=Time.time+Random.Range(3.5f,8.5f);}
    }
}
