using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityCollectible : MonoBehaviour, IRushCityReusable
    {
        [SerializeField] int zqValue = 1;
        [SerializeField] float spinDegrees = 190f;
        [SerializeField] float bobHeight = .16f;
        [SerializeField] float magnetRadius = 8f;
        [SerializeField] float magnetSpeed = 22f;
        float _baseY;
        Vector3 _spawnLocalPosition;
        Transform _player;

        void Awake()
        {
            _spawnLocalPosition=transform.localPosition;
            _baseY=_spawnLocalPosition.y;
        }

        void Start()
        {
            var p=FindFirstObjectByType<RushCityPlayerController>();
            if(p)_player=p.transform;
        }

        void Update()
        {
            transform.Rotate(0f, spinDegrees * Time.deltaTime, 0f, Space.World);
            var gm=RushCityGameManager.Instance;
            if(gm!=null&&gm.MagnetActive&&_player!=null)
            {
                var d=Vector3.Distance(transform.position,_player.position);
                if(d<=magnetRadius)
                {
                    transform.position=Vector3.MoveTowards(transform.position,_player.position+Vector3.up*.8f,magnetSpeed*Time.deltaTime);
                    if(d<.9f)Collect();
                    return;
                }
            }
            var p = transform.localPosition;
            p.y = _baseY + Mathf.Sin(Time.time * 5.2f + transform.position.z) * bobHeight;
            transform.localPosition = p;
        }

        public void Collect()
        {
            if(!gameObject.activeSelf)return;
            RushCityGameManager.Instance?.CollectZq(zqValue);
            gameObject.SetActive(false);
        }

        public void ResetForReuse()
        {
            transform.localPosition=_spawnLocalPosition;
            gameObject.SetActive(true);
            if(!_player)
            {
                var p=FindFirstObjectByType<RushCityPlayerController>();
                if(p)_player=p.transform;
            }
        }
    }
}
