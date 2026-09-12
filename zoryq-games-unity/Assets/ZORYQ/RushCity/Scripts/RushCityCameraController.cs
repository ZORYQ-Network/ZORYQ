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

        void Awake() => _camera = GetComponent<Camera>();

        void LateUpdate()
        {
            if (!target) return;
            var desired = target.TransformPoint(offset);
            transform.position = Vector3.Lerp(transform.position, desired, 1f - Mathf.Exp(-followSharpness * Time.deltaTime));
            var look = target.position + Vector3.up * 1.15f + Vector3.forward * lookAhead;
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(look - transform.position), 1f - Mathf.Exp(-12f * Time.deltaTime));
            var speed = RushCityGameManager.Instance ? RushCityGameManager.Instance.CurrentSpeed : 12f;
            var t = Mathf.InverseLerp(12f, 30f, speed);
            _camera.fieldOfView = Mathf.Lerp(baseFov, maxFov, t);
        }
    }
}
