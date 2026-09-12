using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityObstacle : MonoBehaviour
    {
        [Range(.1f, .8f)] public float severity = .28f;
        bool _consumed;

        public void Hit(RushCityPlayerController player)
        {
            if (_consumed) return;
            _consumed = true;
            RushCityGameManager.Instance?.HitObstacle(severity);
            if (gameObject.activeInHierarchy) gameObject.SetActive(false);
        }
    }
}
