using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityRouteChoiceZone : MonoBehaviour, IRushCityReusable
    {
        bool _chosen;
        void OnTriggerEnter(Collider other)
        {
            if(_chosen)return;
            var player=other.GetComponent<RushCityPlayerController>();
            if(!player)return;
            var director=RushCityRouteDirector.Instance;
            if(!director)return;
            _chosen=true;
            var direction=director.SuggestedDirection(player.Lane);
            director.ChooseBranch(direction,transform.position.z);
        }

        public void ResetForReuse(){_chosen=false;gameObject.SetActive(true);}
    }
}
