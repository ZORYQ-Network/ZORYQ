using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityCollectible : MonoBehaviour
    {
        [SerializeField] int zqValue = 1;
        [SerializeField] float spinDegrees = 190f;
        [SerializeField] float bobHeight = .16f;
        float _baseY;

        void Start() => _baseY = transform.localPosition.y;

        void Update()
        {
            transform.Rotate(0f, spinDegrees * Time.deltaTime, 0f, Space.World);
            var p = transform.localPosition;
            p.y = _baseY + Mathf.Sin(Time.time * 5.2f + transform.position.z) * bobHeight;
            transform.localPosition = p;
        }

        public void Collect()
        {
            RushCityGameManager.Instance?.CollectZq(zqValue);
            gameObject.SetActive(false);
        }
    }
}
