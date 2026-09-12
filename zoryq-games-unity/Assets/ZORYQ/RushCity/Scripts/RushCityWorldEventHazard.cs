using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityWorldEventHazard : MonoBehaviour
    {
        [SerializeField] float severity=.32f;
        [SerializeField] float armDelay=.8f;
        [SerializeField] float activeSeconds=3.5f;
        [SerializeField] Vector3 worldVelocity;
        [SerializeField] Color warningColor=new Color(1f,.35f,.1f,1f);
        [SerializeField] Color activeColor=new Color(1f,.04f,.16f,1f);

        Collider _collider;
        Renderer _renderer;
        Material _material;
        float _spawnAt;
        bool _armed;
        bool _consumed;

        public RushCityWorldEventHazard Configure(Vector3 velocity,float delay,float lifetime,float hitSeverity,Color warning,Color active)
        {
            worldVelocity=velocity;
            armDelay=Mathf.Max(.15f,delay);
            activeSeconds=Mathf.Max(.35f,lifetime);
            severity=Mathf.Clamp(hitSeverity,.08f,.8f);
            warningColor=warning;
            activeColor=active;
            return this;
        }

        void Awake()
        {
            _collider=GetComponent<Collider>();
            _renderer=GetComponent<Renderer>();
            if(_renderer)
            {
                _material=_renderer.material;
                _material.EnableKeyword("_EMISSION");
            }
        }

        void OnEnable()
        {
            _spawnAt=Time.time;
            _armed=false;
            _consumed=false;
            if(_collider)_collider.enabled=false;
        }

        void Update()
        {
            transform.position+=worldVelocity*Time.deltaTime;
            var age=Time.time-_spawnAt;
            if(!_armed&&age>=armDelay)
            {
                _armed=true;
                if(_collider)_collider.enabled=true;
            }

            if(_material)
            {
                var pulse=.55f+.45f*Mathf.Sin(Time.time*14f);
                var c=_armed?activeColor:Color.Lerp(warningColor,Color.white,pulse*.3f);
                _material.color=c;
                _material.SetColor("_EmissionColor",c*(_armed?3.2f:1.4f+pulse));
            }

            if(age>=armDelay+activeSeconds)Destroy(gameObject);
        }

        void OnTriggerEnter(Collider other)
        {
            if(!_armed||_consumed)return;
            var player=other.GetComponent<RushCityPlayerController>();
            if(!player)player=other.GetComponentInParent<RushCityPlayerController>();
            if(!player)return;
            _consumed=true;
            if(_collider)_collider.enabled=false;
            RushCityGameManager.Instance?.HitObstacle(severity);
            RushCityGameEvents.RaiseImpact(severity);
        }
    }
}
