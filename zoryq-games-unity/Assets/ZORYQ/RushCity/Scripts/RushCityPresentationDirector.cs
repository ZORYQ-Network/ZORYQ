using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityPresentationDirector : MonoBehaviour
    {
        [SerializeField] RushCityCameraController rushCamera;
        [SerializeField] Animator runnerAnimator;
        [SerializeField] ParticleSystem speedBurst;
        [SerializeField] ParticleSystem impactBurst;
        [SerializeField] ParticleSystem zqBurst;
        [SerializeField] ParticleSystem powerUpBurst;

        public void Configure(RushCityCameraController camera,Animator animator=null)
        {
            rushCamera=camera;
            runnerAnimator=animator;
        }

        void OnEnable()
        {
            RushCityGameEvents.LaneChanged+=OnLane;
            RushCityGameEvents.Jumped+=OnJump;
            RushCityGameEvents.Slid+=OnSlide;
            RushCityGameEvents.WallRan+=OnWallRun;
            RushCityGameEvents.ZqCollected+=OnZq;
            RushCityGameEvents.NearMissed+=OnNearMiss;
            RushCityGameEvents.Impacted+=OnImpact;
            RushCityGameEvents.PowerUpActivated+=OnPowerUp;
            RushCityGameEvents.RouteChosen+=OnRoute;
            RushCityGameEvents.MissionCompleted+=OnMission;
        }

        void OnDisable()
        {
            RushCityGameEvents.LaneChanged-=OnLane;
            RushCityGameEvents.Jumped-=OnJump;
            RushCityGameEvents.Slid-=OnSlide;
            RushCityGameEvents.WallRan-=OnWallRun;
            RushCityGameEvents.ZqCollected-=OnZq;
            RushCityGameEvents.NearMissed-=OnNearMiss;
            RushCityGameEvents.Impacted-=OnImpact;
            RushCityGameEvents.PowerUpActivated-=OnPowerUp;
            RushCityGameEvents.RouteChosen-=OnRoute;
            RushCityGameEvents.MissionCompleted-=OnMission;
        }

        void Trigger(string name){if(runnerAnimator)runnerAnimator.SetTrigger(name);}
        void OnLane(int lane){rushCamera?.RollKick(lane==0?2.1f:lane==2?-2.1f:0f);}
        void OnJump(){Trigger("Jump");rushCamera?.FovKick(1.8f);}
        void OnSlide(){Trigger("Slide");rushCamera?.FovKick(1.1f);}
        void OnWallRun(){Trigger("WallRun");rushCamera?.RollKick(3.2f);rushCamera?.FovKick(3f);speedBurst?.Play();}
        void OnZq(int amount,int combo){if(combo>=4)rushCamera?.FovKick(.8f);zqBurst?.Play();}
        void OnNearMiss(){rushCamera?.Impulse(.32f,.10f);rushCamera?.FovKick(2.2f);speedBurst?.Play();}
        void OnImpact(float severity){Trigger("Hit");rushCamera?.Impulse(Mathf.Lerp(.35f,1.25f,severity),Mathf.Lerp(.12f,.34f,severity));impactBurst?.Play();if(severity>.55f)Handheld.Vibrate();}
        void OnPowerUp(RushPowerUpType type,float duration){rushCamera?.FovKick(type==RushPowerUpType.Overdrive?8f:3.5f);powerUpBurst?.Play();}
        void OnRoute(int direction,string district){rushCamera?.RollKick(direction<0?3.5f:-3.5f);rushCamera?.FovKick(4f);speedBurst?.Play();}
        void OnMission(int score,int zq,string mission){rushCamera?.FovKick(2.4f);powerUpBurst?.Play();}
    }
}
