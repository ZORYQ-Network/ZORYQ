using UnityEngine;

namespace Zoryq.Play.RushCity
{
    [RequireComponent(typeof(Camera))]
    public sealed class RushCityCameraController : MonoBehaviour
    {
        public Transform target;
        public Vector3 offset = new Vector3(0f, 3.2f, -7.4f);
        public float followSharpness = 9f;
        public float lookAhead = 6.5f;
        public float baseFov = 63f;
        public float maxFov = 77f;

        Camera _camera;
        float _impulseStrength;
        float _impulseUntil;
        float _fovKick;
        float _rollKick;

        void Awake() => _camera = GetComponent<Camera>();

        public void Impulse(float strength,float duration=.18f)
        {
            _impulseStrength=Mathf.Max(_impulseStrength,Mathf.Clamp(strength,0f,1.4f));
            _impulseUntil=Mathf.Max(_impulseUntil,Time.unscaledTime+Mathf.Clamp(duration,.05f,.6f));
        }

        public void FovKick(float amount){_fovKick=Mathf.Max(_fovKick,Mathf.Clamp(amount,0f,12f));}
        public void RollKick(float degrees){_rollKick=Mathf.Clamp(_rollKick+degrees,-8f,8f);}

        void LateUpdate()
        {
            if (!target) return;
            var gm=RushCityGameManager.Instance;
            var speed = gm ? gm.CurrentSpeed : 12f;
            var speedT = Mathf.InverseLerp(12f, 34f, speed);
            var flow=gm?gm.SkillFlow:0f;

            var dynamicOffset=offset+new Vector3(0,Mathf.Lerp(0f,.35f,flow),Mathf.Lerp(0f,-.65f,speedT));
            var desired = target.TransformPoint(dynamicOffset);
            var shake=Vector3.zero;
            if(Time.unscaledTime<_impulseUntil)
            {
                var fade=Mathf.InverseLerp(_impulseUntil, _impulseUntil-.22f, Time.unscaledTime);
                var n=Time.unscaledTime*46f;
                shake=new Vector3(Mathf.PerlinNoise(n,1.2f)-.5f,Mathf.PerlinNoise(2.7f,n)-.5f,0f)*(_impulseStrength*fade*.34f);
            }
            else _impulseStrength=Mathf.MoveTowards(_impulseStrength,0f,Time.unscaledDeltaTime*4f);

            transform.position = Vector3.Lerp(transform.position, desired+shake, 1f - Mathf.Exp(-followSharpness * Time.deltaTime));
            var look = target.position + Vector3.up * 1.15f + Vector3.forward * (lookAhead+speedT*2.2f);
            var desiredRotation=Quaternion.LookRotation(look-transform.position)*Quaternion.Euler(0,0,_rollKick);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, 1f - Mathf.Exp(-12f * Time.deltaTime));

            _fovKick=Mathf.MoveTowards(_fovKick,0f,Time.unscaledDeltaTime*18f);
            _rollKick=Mathf.MoveTowards(_rollKick,0f,Time.unscaledDeltaTime*24f);
            _camera.fieldOfView = Mathf.Lerp(_camera.fieldOfView,Mathf.Lerp(baseFov,maxFov,speedT)+_fovKick,1f-Mathf.Exp(-8f*Time.unscaledDeltaTime));
        }
    }
}
