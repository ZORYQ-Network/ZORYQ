using System.Collections.Generic;
using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityCharacterAnimator : MonoBehaviour
    {
        [SerializeField] RushCityPlayerController controller;
        [SerializeField] Transform visualRoot;
        [SerializeField] Animator animator;
        [SerializeField] float fallbackLean=11f;
        [SerializeField] float fallbackBob=.055f;

        readonly HashSet<int> _parameters=new HashSet<int>();
        Vector3 _basePosition;
        Vector3 _baseScale;
        Quaternion _baseRotation;
        int _lastLane=1;
        float _laneLean;

        static readonly int Speed=Animator.StringToHash("Speed");
        static readonly int VerticalVelocity=Animator.StringToHash("VerticalVelocity");
        static readonly int Grounded=Animator.StringToHash("Grounded");
        static readonly int Slide=Animator.StringToHash("Slide");
        static readonly int WallRun=Animator.StringToHash("WallRun");
        static readonly int WallSide=Animator.StringToHash("WallSide");
        static readonly int Boost=Animator.StringToHash("Boost");
        static readonly int Hit=Animator.StringToHash("Hit");
        static readonly int RouteTurn=Animator.StringToHash("RouteTurn");

        public void Configure(RushCityPlayerController player,Transform visual,Animator characterAnimator=null)
        {
            controller=player;
            visualRoot=visual;
            animator=characterAnimator;
            CacheVisualBase();
            CacheParameters();
        }

        void Awake()
        {
            if(!controller)controller=GetComponent<RushCityPlayerController>();
            if(!visualRoot&&transform.childCount>0)visualRoot=transform.GetChild(0);
            if(!animator&&visualRoot)animator=visualRoot.GetComponentInChildren<Animator>();
            CacheVisualBase();
            CacheParameters();
        }

        void OnEnable()
        {
            RushCityGameEvents.LaneChanged+=OnLane;
            RushCityGameEvents.Impacted+=OnImpact;
            RushCityGameEvents.RouteChosen+=OnRoute;
        }

        void OnDisable()
        {
            RushCityGameEvents.LaneChanged-=OnLane;
            RushCityGameEvents.Impacted-=OnImpact;
            RushCityGameEvents.RouteChosen-=OnRoute;
        }

        void Update()
        {
            if(!controller)return;
            var gm=RushCityGameManager.Instance;
            var speed=gm?gm.CurrentSpeed:0f;
            var boost=gm&&gm.OverdriveActive;

            if(animator&&animator.runtimeAnimatorController)
            {
                SetFloat(Speed,speed);
                SetFloat(VerticalVelocity,controller.VerticalVelocity);
                SetBool(Grounded,controller.IsGrounded);
                SetBool(Slide,controller.IsSliding);
                SetBool(WallRun,controller.IsWallRunning);
                SetFloat(WallSide,controller.WallRunSide);
                SetBool(Boost,boost);
            }
            else ApplyFallback(speed,boost);
        }

        void ApplyFallback(float speed,bool boost)
        {
            if(!visualRoot)return;
            var run=Mathf.Clamp01(speed/32f);
            var bob=controller.IsGrounded&&!controller.IsSliding?Mathf.Sin(Time.time*13f)*fallbackBob*run:0f;
            var wallTilt=controller.IsWallRunning?controller.WallRunSide*-18f:0f;
            _laneLean=Mathf.MoveTowards(_laneLean,0f,Time.deltaTime*28f);
            var targetRotation=_baseRotation*Quaternion.Euler(0,0,_laneLean+wallTilt);
            visualRoot.localRotation=Quaternion.Slerp(visualRoot.localRotation,targetRotation,1f-Mathf.Exp(-13f*Time.deltaTime));
            visualRoot.localPosition=Vector3.Lerp(visualRoot.localPosition,_basePosition+Vector3.up*bob,1f-Mathf.Exp(-16f*Time.deltaTime));
            var slideScale=controller.IsSliding?new Vector3(1f,.62f,1.08f):Vector3.one;
            var boostScale=boost?new Vector3(1f,1f,1.06f):Vector3.one;
            visualRoot.localScale=Vector3.Lerp(visualRoot.localScale,Vector3.Scale(_baseScale,Vector3.Scale(slideScale,boostScale)),1f-Mathf.Exp(-18f*Time.deltaTime));
        }

        void OnLane(int lane)
        {
            var direction=Mathf.Clamp(lane-_lastLane,-1,1);
            _lastLane=lane;
            _laneLean=-direction*fallbackLean;
        }

        void OnImpact(float severity){SetTrigger(Hit);}
        void OnRoute(int direction,string district){SetTrigger(RouteTurn);_laneLean=-direction*fallbackLean*1.35f;}

        void CacheVisualBase()
        {
            if(!visualRoot)return;
            _basePosition=visualRoot.localPosition;
            _baseRotation=visualRoot.localRotation;
            _baseScale=visualRoot.localScale;
        }

        void CacheParameters()
        {
            _parameters.Clear();
            if(!animator||!animator.runtimeAnimatorController)return;
            foreach(var p in animator.parameters)_parameters.Add(p.nameHash);
        }

        void SetFloat(int hash,float value){if(animator&&_parameters.Contains(hash))animator.SetFloat(hash,value,.08f,Time.deltaTime);}
        void SetBool(int hash,bool value){if(animator&&_parameters.Contains(hash))animator.SetBool(hash,value);}
        void SetTrigger(int hash){if(animator&&_parameters.Contains(hash))animator.SetTrigger(hash);}
    }
}
