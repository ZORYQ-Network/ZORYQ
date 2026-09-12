using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityChaseDirector : MonoBehaviour
    {
        [SerializeField] Transform player;
        [SerializeField] Transform chaser;
        [SerializeField] float farDistance = 16f;
        [SerializeField] float caughtDistance = 2.2f;
        [SerializeField] float followSharpness = 6f;
        [SerializeField] float lateralSway = .9f;
        [SerializeField] Light warningLight;

        public void Configure(Transform runner,Transform pursuer,Light warning){player=runner;chaser=pursuer;warningLight=warning;}

        void Start()
        {
            if(!player)
            {
                var p=FindFirstObjectByType<RushCityPlayerController>();
                if(p)player=p.transform;
            }
        }

        void LateUpdate()
        {
            var gm=RushCityGameManager.Instance;
            if(!gm||!gm.IsRunning||!player||!chaser)return;
            var distance=Mathf.Lerp(farDistance,caughtDistance,gm.ChasePressure);
            var target=player.position-new Vector3(0,-.7f,distance);
            target.x+=Mathf.Sin(Time.time*2.3f)*lateralSway*gm.ChasePressure;
            chaser.position=Vector3.Lerp(chaser.position,target,1f-Mathf.Exp(-followSharpness*Time.deltaTime));
            chaser.LookAt(player.position+Vector3.up);
            if(warningLight)
            {
                warningLight.intensity=Mathf.Lerp(.4f,5f,gm.ChasePressure);
                warningLight.color=Color.Lerp(new Color(.1f,.7f,1f),new Color(1f,.05f,.2f),gm.ChasePressure);
            }
        }
    }
}
