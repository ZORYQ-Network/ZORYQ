using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityNearMissZone : MonoBehaviour
    {
        bool _awarded;
        void OnTriggerExit(Collider other)
        {
            if(_awarded||other.GetComponent<RushCityPlayerController>()==null)return;
            _awarded=true;
            RushCityGameManager.Instance?.RegisterNearMiss();
        }
    }
}
