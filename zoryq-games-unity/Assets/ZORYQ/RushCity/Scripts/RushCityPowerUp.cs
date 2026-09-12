using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public enum RushPowerUpType { Magnet, Shield, Overdrive, Multiplier }

    public sealed class RushCityPowerUp : MonoBehaviour
    {
        [SerializeField] RushPowerUpType type = RushPowerUpType.Magnet;
        [SerializeField] float duration = 8f;
        [SerializeField] float spinDegrees = 120f;

        void Update(){transform.Rotate(0f,spinDegrees*Time.deltaTime,0f,Space.World);}

        void OnTriggerEnter(Collider other)
        {
            if(other.GetComponent<RushCityPlayerController>()==null)return;
            RushCityGameManager.Instance?.ActivatePowerUp(type,duration);
            gameObject.SetActive(false);
        }
    }
}
