using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityNearMissZone : MonoBehaviour, IRushCityReusable
    {
        [SerializeField] float lateralClearance=.62f;
        [SerializeField] float verticalClearance=.9f;
        bool _awarded;

        void OnTriggerExit(Collider other)
        {
            if(_awarded)return;
            var player=other.GetComponent<RushCityPlayerController>();
            if(player==null)return;
            var lateral=Mathf.Abs(other.transform.position.x-transform.position.x);
            var vertical=Mathf.Abs(other.transform.position.y-transform.position.y);
            if(lateral<lateralClearance&&vertical<verticalClearance)return;
            _awarded=true;
            RushCityGameManager.Instance?.RegisterNearMiss();
        }

        public void ResetForReuse(){_awarded=false;gameObject.SetActive(true);}
    }
}
