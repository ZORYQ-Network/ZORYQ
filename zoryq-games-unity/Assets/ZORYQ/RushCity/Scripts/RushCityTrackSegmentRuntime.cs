using UnityEngine;

namespace Zoryq.Play.RushCity
{
    public sealed class RushCityTrackSegmentRuntime : MonoBehaviour
    {
        IRushCityReusable[] _reusables;

        void Awake()=>Cache();

        void Cache()
        {
            var behaviours=GetComponentsInChildren<MonoBehaviour>(true);
            var count=0;
            for(var i=0;i<behaviours.Length;i++)if(behaviours[i] is IRushCityReusable)count++;
            _reusables=new IRushCityReusable[count];
            var index=0;
            for(var i=0;i<behaviours.Length;i++)
                if(behaviours[i] is IRushCityReusable reusable)_reusables[index++]=reusable;
        }

        public void ResetForReuse()
        {
            if(_reusables==null||_reusables.Length==0)Cache();
            for(var i=0;i<_reusables.Length;i++)_reusables[i]?.ResetForReuse();
        }
    }
}
